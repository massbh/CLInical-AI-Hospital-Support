# Report Generator Service

**Language:** Python  
**Framework:** FastAPI + APScheduler  
**Purpose:** Generates PDF reports from medical consultation notes and manages the report preview workflow

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

### Configuration

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your settings:**
   ```env
   DATABASE_URL=postgresql://clinicalai:clinicalai@localhost:5432/clinicalai
   SERVICE_PORT=8004
   API_KEY=your-secret-key
   SCHEDULER_INTERVAL_SECONDS=60  # 60 seconds for development, 3600 for production
   SCHEDULER_ENABLED=true
   ```

### Running the Service

```bash
# Development mode (auto-reload)
uvicorn app.main:app --reload --port 8004

# Production mode
uvicorn app.main:app --port 8004 --workers 1
```

The service will be available at `http://localhost:8004`

## API Endpoints

All endpoints except `/health` require the `X-API-Key` header:
```
X-API-Key: your-secret-key
```

### Health Check
- `GET /health` - Service health status and scheduler state (no auth required)
  - **Response:**
    ```json
    {
      "status": "ok",
      "service": "Report Generator",
      "port": 8004,
      "scheduler": "running"
    }
    ```

### Report Processing
- `POST /process-reports` - Manually trigger report processing (requires API key)
  - **Headers:** `X-API-Key: your-secret-key`
  - **Response:**
    ```json
    {
      "success": true,
      "message": "Report processing completed successfully",
      "reports_processed": 0,
      "failed": 2,
      "skipped": 0
    }
    ```

### Scheduler Status
- `GET /scheduler/status` - Get scheduler status and next run time (requires API key)
  - **Headers:** `X-API-Key: your-secret-key`
  - **Response:**
    ```json
    {
      "scheduler_status": "running",
      "next_run_time": "2026-05-07 14:51:22.868933+02:00",
      "interval_seconds": 60
    }
    ```

## Architecture

### Scheduler
- Runs in background automatically when service starts
- Default interval: 1 hour (configurable via `SCHEDULER_INTERVAL_SECONDS`)
- Can be disabled via `SCHEDULER_ENABLED=false`

### Report Workflow

1. **Preview Mode** (`preview=NULL`)
   - Report sent to frontend UI at `PREVIEW_UI_ENDPOINT`
   - User reviews and edits the content
   - Flag remains `NULL` until user accepts

2. **Production Mode** (`preview=TRUE`)
   - PDF generated from report sections
   - Stored in `PDF_OUTPUT_DIR`
   - Flag set to `FALSE` after generation

3. **Processed** (`preview=FALSE`)
   - Report already processed
   - Skipped in future cycles

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_PORT` | `8004` | Port where service runs (avoids conflict with tradLlm:8002) |
| `API_KEY` | `dev-key` | Secret key for X-API-Key authentication |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `PDF_OUTPUT_DIR` | `reports/` | Directory to store generated PDFs |
| `PREVIEW_UI_ENDPOINT` | `http://localhost:3000/api/reports` | Frontend preview endpoint base URL |
| `SCHEDULER_INTERVAL_SECONDS` | `3600` | Seconds between processing cycles (3600=1 hour, 60=1 minute) |
| `SCHEDULER_ENABLED` | `true` | Enable/disable background scheduler |
| `PREVIEW_UI_TIMEOUT_SECONDS` | `10.0` | HTTP timeout for preview UI requests (seconds) |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |

## Logging

Logs are output to console with the configured `LOG_LEVEL`. Key events include:
- Scheduler startup/shutdown
- Report processing lifecycle
- PDF generation success/failures
- Preview UI connection issues

## Dependencies

- **FastAPI**: Web framework
- **APScheduler**: Background task scheduling
- **ReportLab**: PDF generation
- **httpx**: HTTP client for preview UI communication
- **psycopg2**: PostgreSQL database adapter
- **python-dotenv**: Environment variable management
