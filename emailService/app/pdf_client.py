import os

import httpx


def fetch_pdf_bytes(report_id: str) -> bytes:
    """Fetch the PDF for a finalized report from reportGenerator."""
    base = os.getenv("REPORT_GENERATOR_URL", "http://localhost:8004").rstrip("/")
    timeout = float(os.getenv("REPORT_GENERATOR_TIMEOUT_SECONDS", "30"))
    response = httpx.post(f"{base}/generate-pdf/{report_id}", timeout=timeout)
    response.raise_for_status()
    return response.content
