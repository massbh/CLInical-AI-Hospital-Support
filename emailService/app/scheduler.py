"""Background poller that finds finalized reports and emails them."""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler

from app import db
from app.service import ReportNotFound, send_report_email

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _tick() -> None:
    try:
        claimed = db.claim_ready_reports()
    except Exception as exc:
        logger.error("Failed to claim reports: %s", exc, exc_info=True)
        return

    if not claimed:
        return

    logger.info("Claimed %d report(s) for emailing: %s", len(claimed), claimed)
    for report_id in claimed:
        try:
            recipient = send_report_email(report_id)
            db.mark_sent(report_id)
            logger.info("Sent report %s to %s", report_id, recipient)
        except ReportNotFound:
            db.mark_failed(report_id, "Report not found in database")
            logger.error("Report %s missing — marked failed", report_id)
        except Exception as exc:
            db.mark_failed(report_id, str(exc))
            logger.error("Failed to send report %s: %s", report_id, exc, exc_info=True)


def start() -> None:
    global _scheduler
    if os.getenv("EMAIL_SCHEDULER_ENABLED", "true").lower() != "true":
        logger.warning("Email scheduler disabled via EMAIL_SCHEDULER_ENABLED")
        return
    interval = int(os.getenv("EMAIL_POLL_INTERVAL_SECONDS", "60"))
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _tick,
        "interval",
        seconds=interval,
        id="poll_reports",
        name="Poll finalized reports",
        replace_existing=True,
        next_run_time=None,
    )
    _scheduler.start()
    logger.info("Email scheduler started — polling every %ds", interval)


def stop() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        logger.info("Email scheduler stopped")
    _scheduler = None
