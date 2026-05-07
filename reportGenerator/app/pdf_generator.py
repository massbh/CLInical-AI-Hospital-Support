"""PDF generation and report processing logic."""

import logging
from datetime import datetime

import httpx
import psycopg2
from psycopg2.extras import RealDictCursor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from app.config import config

logger = logging.getLogger(__name__)


def get_db_connection():
    """Create and return a PostgreSQL database connection."""
    try:
        conn = psycopg2.connect(config.DATABASE_URL)
        return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Failed to connect to database: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {e}")
        raise


def fetch_report(report_id: str) -> dict | None:
    """Fetch a single report by ID."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, patient_name, patient_surname, doctor_name, 
                       title, date, content, preview
                FROM reports
                WHERE id = %s
                """,
                (report_id,),
            )
            result = cur.fetchone()
        conn.close()
        return result
    except Exception as e:
        logger.error(f"Error fetching report {report_id}: {e}")
        return None


def fetch_report_sections(report_id: str) -> list[dict]:
    """Fetch all sections for a specific report."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, content, status
                FROM report_sections
                WHERE report_id = %s
                ORDER BY id ASC
                """,
                (report_id,),
            )
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        logger.error(f"Error fetching sections for report {report_id}: {e}")
        return []


def fetch_reports_for_processing_db() -> list[dict]:
    """Fetch all reports where preview is NOT false (null or true)."""
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, patient_name, patient_surname, doctor_name, 
                       title, date, content, preview
                FROM reports
                WHERE preview IS NOT FALSE
                ORDER BY date DESC
                """,
            )
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        logger.error(f"Error fetching reports for processing: {e}")
        raise


def update_report_preview_flag_db(report_id: str, preview_value) -> bool:
    """Update report preview flag: None, True, or False."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reports
                SET preview = %s
                WHERE id = %s
                """,
                (preview_value, report_id),
            )
        conn.commit()
        conn.close()
        logger.debug(f"Report {report_id} preview flag updated to {preview_value}")
        return True
    except Exception as e:
        logger.error(f"Error updating report preview flag for {report_id}: {e}")
        raise


def loop_reports(report_id: str) -> dict:
    """
    Fetch and organize report sections by type.
    
    Returns dict with keys: assessment, diagnosis, prescription
    """
    sections_data = {
        "assessment": None,
        "diagnosis": None,
        "prescription": None,
        "other": []
    }
    
    try:
        sections = fetch_report_sections(report_id)
        
        for section in sections:
            title_lower = section.get('title', '').lower().strip()
            content = section.get('content', '')
            
            if 'assess' in title_lower or 'symptom' in title_lower:
                sections_data["assessment"] = {
                    "title": section.get('title'),
                    "content": content
                }
            elif 'diagnos' in title_lower:
                sections_data["diagnosis"] = {
                    "title": section.get('title'),
                    "content": content
                }
            elif 'prescri' in title_lower or 'recommendation' in title_lower:
                sections_data["prescription"] = {
                    "title": section.get('title'),
                    "content": content
                }
            else:
                # Store other sections
                sections_data["other"].append({
                    "title": section.get('title'),
                    "content": content
                })
        
        logger.info(f"Organized sections for report {report_id}: "
                   f"assessment={sections_data['assessment'] is not None}, "
                   f"diagnosis={sections_data['diagnosis'] is not None}, "
                   f"prescription={sections_data['prescription'] is not None}")
        
        return sections_data
        
    except Exception as e:
        logger.error(f"Error organizing sections for report {report_id}: {e}")
        return sections_data


def generate_formatted_pdf(sections_data: dict, report_data: dict, output_file: str) -> bool:
    """
    Generate a structured PDF with Assessment → Diagnosis → Prescription sections.
    
    Args:
        sections_data: Dict with keys assessment, diagnosis, prescription
        report_data: Report metadata (patient name, doctor, date, etc.)
        output_file: Path to output PDF
    """
    try:
        doc = SimpleDocTemplate(output_file, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
        story = []
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=6,
            fontName='Helvetica-Bold'
        )
        heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold',
            borderPadding=6,
            borderColor=colors.HexColor('#3498db'),
            borderWidth=2,
            borderRadius=3
        )
        body_style = ParagraphStyle(
            'CustomBody',
            parent=styles['BodyText'],
            fontSize=10,
            leading=14,
            spaceAfter=12,
            alignment=4  # justify
        )
        
        # Report header
        patient_name = f"{report_data.get('patient_name', '')} {report_data.get('patient_surname', '')}"
        doctor_name = report_data.get('doctor_name', 'Unknown Doctor')
        report_date = report_data.get('date', 'N/A')
        report_title = report_data.get('title', 'Medical Report')
        
        story.append(Paragraph(report_title, title_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Patient and doctor info
        info_data = [
            ['Patient:', patient_name],
            ['Doctor:', doctor_name],
            ['Date:', str(report_date)]
        ]
        info_table = Table(info_data, colWidths=[1.5*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
            ('FONT', (1, 0), (1, -1), 'Helvetica', 10),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.2*inch))
        
        # 1. Assessment Section (First)
        if sections_data.get('assessment'):
            story.append(Paragraph("1. Assessment", heading_style))
            assessment_content = sections_data['assessment'].get('content', '')
            story.append(Paragraph(assessment_content, body_style))
            story.append(Spacer(1, 0.1*inch))
        
        # 2. Diagnosis Section (Second)
        if sections_data.get('diagnosis'):
            story.append(Paragraph("2. Diagnosis", heading_style))
            diagnosis_content = sections_data['diagnosis'].get('content', '')
            story.append(Paragraph(diagnosis_content, body_style))
            story.append(Spacer(1, 0.1*inch))
        
        # 3. Prescription Section (Last)
        if sections_data.get('prescription'):
            story.append(Paragraph("3. Prescription & Recommendations", heading_style))
            prescription_content = sections_data['prescription'].get('content', '')
            story.append(Paragraph(prescription_content, body_style))
            story.append(Spacer(1, 0.1*inch))
        
        # 4. Other sections (if any)
        if sections_data.get('other'):
            for idx, section in enumerate(sections_data['other'], 4):
                section_title = section.get('title', f'Section {idx}')
                section_content = section.get('content', '')
                story.append(Paragraph(f"{idx}. {section_title}", heading_style))
                story.append(Paragraph(section_content, body_style))
                story.append(Spacer(1, 0.1*inch))
        
        # Build PDF
        doc.build(story)
        logger.info(f"Structured PDF generated successfully: {output_file}")
        return True
        
    except Exception as e:
        logger.error(f"Error generating structured PDF: {e}", exc_info=True)
        raise


def send_to_preview_ui(report_id: str, report_data: dict) -> bool:
    """Forward structured report to preview UI via HTTP POST."""
    try:
        logger.info(f"Sending report {report_id} to preview UI...")
        
        # Fetch all report sections
        sections = fetch_report_sections(report_id)
        
        # Structure the data for preview UI
        structured_data = {
            "report_id": report_id,
            "patient_name": report_data['patient_name'],
            "patient_surname": report_data['patient_surname'],
            "doctor_name": report_data['doctor_name'],
            "title": report_data['title'],
            "date": str(report_data['date']),
            "sections": [
                {
                    "title": section['title'],
                    "content": section['content'],
                    "status": section['status']
                }
                for section in sections
            ]
        }
        
        # POST to preview endpoint
        preview_endpoint = config.PREVIEW_UI_ENDPOINT
        
        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{preview_endpoint}/{report_id}",
                    json=structured_data,
                    timeout=config.PREVIEW_UI_TIMEOUT_SECONDS
                )
                response.raise_for_status()
            
            logger.info(
                f"Preview sent to UI: Report {report_id} | "
                f"Patient: {report_data['patient_name']} {report_data['patient_surname']} | "
                f"Doctor: {report_data['doctor_name']} | Sections: {len(sections)}"
            )
            return True
            
        except httpx.TimeoutException:
            logger.error(
                f"Timeout connecting to preview UI at {preview_endpoint} "
                f"for report {report_id} (timeout: {config.PREVIEW_UI_TIMEOUT_SECONDS}s)"
            )
            return False
        except httpx.RequestError as e:
            logger.error(f"Connection error to preview UI at {preview_endpoint}: {e}")
            return False
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Preview UI returned error for report {report_id}: "
                f"{e.response.status_code} - {e.response.text}"
            )
            return False
            
    except Exception as e:
        logger.error(f"Error sending report {report_id} to preview UI: {e}", exc_info=True)
        return False


def process_report(report_id: str, output_dir: str) -> bool:
    """
    Main logic to handle report based on preview flag.
    
    - preview=NULL: Send to preview UI
    - preview=TRUE: Generate PDF and set to FALSE
    - preview=FALSE: Skip (already processed)
    """
    try:
        report = fetch_report(report_id)
        if not report:
            logger.warning(f"Report {report_id} not found in database")
            return False
        
        preview_flag = report.get('preview')
        
        if preview_flag is None:
            # Preview mode: send to UI, leave flag unchanged
            logger.info(f"Processing report {report_id} in PREVIEW mode")
            success = send_to_preview_ui(report_id, report)
            
            if not success:
                logger.warning(
                    f"Failed to send report {report_id} to preview UI. "
                    "Will retry in next scheduler cycle."
                )
            
            return success
            
        elif preview_flag is True:
            # Production mode: generate PDF and set flag to false
            logger.info(f"Processing report {report_id} in PRODUCTION mode")
            
            try:
                # Fetch and organize sections
                sections_data = loop_reports(report_id)
                
                # Generate structured PDF
                pdf_path = f"{output_dir}report_{report_id}.pdf"
                generate_formatted_pdf(sections_data, report, pdf_path)
                
                # Update flag to false (already processed)
                update_report_preview_flag_db(report_id, False)
                logger.info(f"Report {report_id} marked as processed and PDF generated")
                
                return True
                
            except Exception as e:
                logger.error(f"Error generating PDF for report {report_id}: {e}", exc_info=True)
                return False
            
        elif preview_flag is False:
            # Already processed: skip
            logger.debug(f"Report {report_id} already processed, skipping")
            return True
            
    except Exception as e:
        logger.error(f"Error processing report {report_id}: {e}", exc_info=True)
        return False


def process_all_pending_reports(output_dir: str = None) -> dict:
    """
    Process all reports that need processing (preview NULL or TRUE).
    
    Returns a dict with processing statistics.
    """
    if output_dir is None:
        output_dir = config.PDF_OUTPUT_DIR
    
    stats = {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "processed": 0,
        "failed": 0,
        "skipped": 0,
        "preview_sent": 0,
        "pdf_generated": 0,
    }
    
    try:
        # Fetch all reports that need processing
        reports = fetch_reports_for_processing_db()
        logger.info(f"Found {len(reports)} reports to process")
        stats["total"] = len(reports)
        
        for report in reports:
            try:
                preview_flag = report.get('preview')
                
                # Process the report
                success = process_report(report['id'], output_dir)
                
                if success:
                    stats["processed"] += 1
                    if preview_flag is None:
                        stats["preview_sent"] += 1
                    elif preview_flag is True:
                        stats["pdf_generated"] += 1
                    else:
                        stats["skipped"] += 1
                else:
                    stats["failed"] += 1
                    
            except Exception as e:
                logger.error(f"Error processing report {report['id']}: {e}")
                stats["failed"] += 1
        
        logger.info(
            f"Report processing completed: "
            f"{stats['processed']} processed, "
            f"{stats['failed']} failed, "
            f"{stats['skipped']} skipped"
        )
        
    except Exception as e:
        logger.error(f"Error in batch processing: {e}", exc_info=True)
        stats["status"] = "error"
        stats["message"] = str(e)
    
    return stats
