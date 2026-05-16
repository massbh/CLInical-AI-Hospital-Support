import asyncio
import importlib

import httpx
import pytest
import respx

from app import session as session_mod


@pytest.fixture(autouse=True)
def fast_poll(monkeypatch):
    monkeypatch.setattr(session_mod, "SESSION_POLL_INTERVAL_S", 0.01)
    yield
    # clear any leftover sessions
    session_mod._sessions.clear()


@pytest.mark.asyncio
@respx.mock
async def test_start_then_stop_session():
    respx.post(session_mod.BATCHING_RESET_URL).mock(return_value=httpx.Response(200))
    # session loop calls read_next_batch (GET) and possibly llm/medbrain
    respx.get("http://batching.test/next-batch").mock(
        return_value=httpx.Response(200, json="")
    )

    started = await session_mod.start_session("appt-1")
    assert started is True
    assert "appt-1" in session_mod.list_sessions()

    # second start is rejected
    started_again = await session_mod.start_session("appt-1")
    assert started_again is False

    stopped = await session_mod.stop_session("appt-1")
    assert stopped is True
    assert "appt-1" not in session_mod.list_sessions()


@pytest.mark.asyncio
async def test_stop_unknown_session_returns_false():
    assert await session_mod.stop_session("nope") is False
