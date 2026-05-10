"""FastAPI application for Report Generator service."""

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.config import config
from app.pdf_generator import (
    build_report_pdf_bytes,
    process_all_pending_reports,
)

# Configure logging
logging.basicConfig(
    level=config.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Response models for standardized API format
class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str = "Report Generator"
    port: int
    scheduler: str

class ProcessReportResponse(BaseModel):
    """Report processing response."""
    success: bool
    message: str
    reports_processed: int
    failed: int
    skipped: int

class SchedulerStatusResponse(BaseModel):
    """Scheduler status response."""
    scheduler_status: str
    next_run_time: Optional[str] = None
    interval_seconds: int

# Global scheduler instance
scheduler: BackgroundScheduler | None = None


def start_scheduler():
    """Initialize and start the background scheduler."""
    global scheduler
    
    if not config.SCHEDULER_ENABLED:
        logger.warning("Scheduler is disabled via configuration")
        return
    
    scheduler = BackgroundScheduler()
    
    # Schedule the report processing job
    scheduler.add_job(
        process_all_pending_reports_wrapper,
        "interval",
        seconds=config.SCHEDULER_INTERVAL_SECONDS,
        id="process_reports",
        name="Process Pending Reports",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info(
        f"Report Generator scheduler started - "
        f"processing every {config.SCHEDULER_INTERVAL_SECONDS} seconds"
    )


def process_all_pending_reports_wrapper():
    """Scheduler entry point — wraps processing with logging and error capture."""
    try:
        logger.info("Starting scheduled report processing...")
        process_all_pending_reports(output_dir=config.PDF_OUTPUT_DIR)
        logger.info("Scheduled report processing completed successfully")
    except Exception as e:
        logger.error(f"Error in scheduled report processing: {e}", exc_info=True)


def stop_scheduler():
    """Stop the background scheduler."""
    global scheduler
    
    if scheduler and scheduler.running:
        scheduler.shutdown()
        logger.info("Report Generator scheduler stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle FastAPI startup and shutdown events."""
    # Startup
    logger.info("Report Generator service starting up...")
    config.validate()
    start_scheduler()
    
    yield
    
    # Shutdown
    logger.info("Report Generator service shutting down...")
    stop_scheduler()


# Create FastAPI app
app = FastAPI(
    title="Report Generator",
    description="PDF Report Generation and Management Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health():
    """Health check endpoint."""
    scheduler_status = "running" if scheduler and scheduler.running else "stopped"
    return HealthResponse(
        status="ok",
        service="Report Generator",
        port=config.SERVICE_PORT,
        scheduler=scheduler_status,
    )


@app.post("/process-reports", response_model=ProcessReportResponse, tags=["reports"])
async def trigger_report_processing():
    """Manually trigger report processing (outside of scheduled time)."""
    try:
        logger.info("Manual report processing triggered via API")
        stats = process_all_pending_reports(output_dir=config.PDF_OUTPUT_DIR)
        return ProcessReportResponse(
            success=True,
            message="Report processing completed successfully",
            reports_processed=stats.get("reports_processed", 0),
            failed=stats.get("failed", 0),
            skipped=stats.get("skipped", 0),
        )
    except Exception as e:
        logger.error(f"Error during manual report processing: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing reports: {str(e)}",
        )


@app.post("/generate-pdf/{report_id}", tags=["reports"])
async def generate_pdf(report_id: str):
    """Generate the PDF for a report and stream it back as a download.

    The PDF is built in-memory and never written to disk; the scheduler still
    handles batch persistence on its own cycle.
    """
    try:
        logger.info(f"On-demand PDF generation requested for report {report_id}")
        pdf_bytes = build_report_pdf_bytes(report_id)
        if pdf_bytes is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report {report_id} not found",
            )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="report_{report_id}.pdf"',
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF for report {report_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating PDF: {str(e)}",
        )


@app.get("/scheduler/status", response_model=SchedulerStatusResponse, tags=["scheduler"])
async def get_scheduler_status():
    """Get current scheduler status."""
    if not scheduler:
        return SchedulerStatusResponse(
            scheduler_status="not_initialized",
            next_run_time=None,
            interval_seconds=config.SCHEDULER_INTERVAL_SECONDS,
        )
    
    next_run = scheduler.get_job("process_reports")
    return SchedulerStatusResponse(
        scheduler_status="running" if scheduler.running else "stopped",
        next_run_time=str(next_run.next_run_time) if next_run and next_run.next_run_time else None,
        interval_seconds=config.SCHEDULER_INTERVAL_SECONDS,
    )


@app.get("/download-pdf/{report_id}", tags=["reports"])
async def download_pdf(report_id: str):
    """Download a generated PDF file."""
    try:
        pdf_path = os.path.join(config.PDF_OUTPUT_DIR, f"report_{report_id}.pdf")
        
        # Check if file exists
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDF not found for report {report_id}. Please generate it first.",
            )
        
        # Return the PDF file
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"report_{report_id}.pdf",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading PDF for report {report_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading PDF: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=config.SERVICE_PORT,
        reload=False,
    )
