import os
import psycopg2
from psycopg2.extras import RealDictCursor


def _get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def fetch_report(report_id: str) -> dict | None:
    with _get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    r.id,
                    r.patient_name,
                    r.patient_surname,
                    r.doctor_name,
                    r.date,
                    r.title,
                    a.email AS patient_email
                FROM reports r
                JOIN accounts a ON a.id = r.patient_id
                WHERE r.id = %s
                """,
                (report_id,),
            )
            return cur.fetchone()


def claim_ready_reports() -> list[str]:
    """Atomically claim every newly-finalized report that hasn't been emailed yet.

    A finalized report is one with `preview = FALSE`. This UPDATE-RETURNING is
    the claim — once a row is in `email_status = 'ready'`, no other tick will
    pick it up.
    """
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reports
                SET email_status = 'ready'
                WHERE preview = FALSE AND email_status IS NULL
                RETURNING id
                """
            )
            return [str(row[0]) for row in cur.fetchall()]


def mark_sent(report_id: str) -> None:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reports
                SET email_status = 'sent',
                    email_sent_at = NOW(),
                    email_last_error = NULL
                WHERE id = %s
                """,
                (report_id,),
            )


def mark_failed(report_id: str, error: str) -> None:
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reports
                SET email_status = 'failed',
                    email_last_error = %s
                WHERE id = %s
                """,
                (error[:2000], report_id),
            )
