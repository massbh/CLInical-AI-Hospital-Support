import os
from datetime import datetime

import httpx


WEBPLATFORM_URL = os.getenv("WEBPLATFORM_URL", "http://localhost:3000")
WEBPLATFORM_TIMEOUT_S = float(os.getenv("WEBPLATFORM_TIMEOUT_S", "2.0"))
PUBLISH_LOG_FILE = "publish_logs.txt"


def _log_publish_failure(kind: str, appointment_id: str, error: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = (
        f"{timestamp} | kind={kind} | appointment_id={appointment_id} | "
        f"error={error}\n"
    )
    with open(PUBLISH_LOG_FILE, "a", encoding="utf-8") as file:
        file.write(line)


async def publish_to_webplatform(kind: str, content: str, appointment_id: str) -> bool:
    """
    POST a validated Note or Suggestion to the webPlatform REST API so it lands
    in Postgres and the /conversation page picks it up on its next poll.

    Returns True on success, False on any failure. Failures are logged but
    never raised — the /ask response should never fail because of a publish.
    """
    if kind == "Note":
        path = "/api/notes"
    elif kind == "Suggestion":
        path = "/api/suggestions"
    else:
        _log_publish_failure(kind, appointment_id, f"unknown kind: {kind!r}")
        return False

    url = f"{WEBPLATFORM_URL.rstrip('/')}{path}"
    payload = {
        "content": content,
        "source": "medBrain",
        "appointmentId": appointment_id,
    }

    try:
        async with httpx.AsyncClient(timeout=WEBPLATFORM_TIMEOUT_S) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        return True
    except Exception as exc:
        _log_publish_failure(kind, appointment_id, str(exc))
        return False
