"""
Per-appointment streaming session.

When an appointment is started in the webPlatform, the conversation route
calls `/session/start` which kicks off a background asyncio task. The task
polls the eavesdropper batching service for new transcript batches, runs
each batch through Ollama, forwards the question to medBrain (which
publishes the validated Note/Suggestion to Postgres), and sleeps until the
next tick. On `/session/stop` the task is cancelled.

State lives in-memory in this process; one task per appointment_id. If the
service restarts, all sessions are lost — clients must restart them.
"""

import asyncio
import os

import httpx

from app.batch_log import log_sent_batch
from app.llm_gate import generate_question_from_batch, read_next_batch
from app.medbrain_gate import forward_to_medbrain


SESSION_POLL_INTERVAL_S = float(os.getenv("SESSION_POLL_INTERVAL_S", "5.0"))
BATCHING_RESET_URL = os.getenv(
    "BATCHING_RESET_URL", "http://127.0.0.1:8000/reset"
)

_sessions: dict[str, asyncio.Task] = {}


async def _reset_batching_state() -> None:
    """Best-effort reset of the eavesdropper batching cursor so each
    appointment starts consuming the transcript from index 0."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(BATCHING_RESET_URL)
    except Exception:
        # Eavesdropper may be down; the loop will still try /next-batch
        # and log empty results until it recovers.
        pass


async def _session_loop(appointment_id: str) -> None:
    while True:
        try:
            batch = await read_next_batch()
        except asyncio.CancelledError:
            raise
        except Exception:
            batch = ""

        if batch:
            try:
                question = await generate_question_from_batch(batch)
                log_sent_batch(
                    batch, question, source=f"session:{appointment_id}"
                )
                try:
                    await forward_to_medbrain(question, appointment_id)
                except Exception:
                    pass
            except asyncio.CancelledError:
                raise
            except Exception:
                pass

        try:
            await asyncio.sleep(SESSION_POLL_INTERVAL_S)
        except asyncio.CancelledError:
            raise


async def start_session(appointment_id: str) -> bool:
    """Start a streaming session for the appointment. Returns True if a new
    session was started, False if one was already running."""
    existing = _sessions.get(appointment_id)
    if existing is not None and not existing.done():
        return False

    await _reset_batching_state()
    task = asyncio.create_task(_session_loop(appointment_id))
    _sessions[appointment_id] = task
    return True


async def stop_session(appointment_id: str) -> bool:
    """Cancel the streaming session. Returns True if a session was running."""
    task = _sessions.pop(appointment_id, None)
    if task is None:
        return False

    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass
    return True


def list_sessions() -> list[str]:
    return [aid for aid, task in _sessions.items() if not task.done()]
