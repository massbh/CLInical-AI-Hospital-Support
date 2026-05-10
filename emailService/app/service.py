"""Shared report-emailing logic, used by both the scheduler and the manual route."""

import logging
import os

from app import db, email_sender, pdf_client, template

logger = logging.getLogger(__name__)


class ReportNotFound(Exception):
    pass


def send_report_email(report_id: str) -> str:
    """Build and send the email for one report. Returns the recipient address.

    Raises ReportNotFound if the report doesn't exist; any other failure
    propagates to the caller, which is expected to record it.
    """
    report = db.fetch_report(report_id)
    if not report:
        raise ReportNotFound(report_id)

    override = os.getenv("EMAIL_RECIPIENT_OVERRIDE", "").strip()
    recipient = override or report["patient_email"]
    if override:
        logger.info(
            "EMAIL_RECIPIENT_OVERRIDE active — sending report %s to %s instead of %s",
            report_id,
            override,
            report["patient_email"],
        )

    pdf_bytes = pdf_client.fetch_pdf_bytes(report_id)
    subject, html, text = template.build_email(report)
    filename = f"report-{report_id}.pdf"
    email_sender.send_email(
        recipient,
        subject,
        html,
        text,
        attachments=[(filename, pdf_bytes)],
    )
    return recipient
