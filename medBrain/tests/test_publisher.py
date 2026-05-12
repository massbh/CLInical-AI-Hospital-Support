import httpx
import pytest
import respx

from app import publisher


@pytest.mark.asyncio
@respx.mock
async def test_publish_note_success():
    route = respx.post(f"{publisher.WEBPLATFORM_URL}/api/notes").mock(
        return_value=httpx.Response(201, json={"id": "1"})
    )
    ok = await publisher.publish_to_webplatform("Note", "hi", "appt-1")
    assert ok is True
    assert route.called


@pytest.mark.asyncio
@respx.mock
async def test_publish_suggestion_success():
    respx.post(f"{publisher.WEBPLATFORM_URL}/api/suggestions").mock(
        return_value=httpx.Response(201, json={"id": "2"})
    )
    ok = await publisher.publish_to_webplatform("Suggestion", "hi", "appt-1")
    assert ok is True


@pytest.mark.asyncio
async def test_publish_unknown_kind_returns_false(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ok = await publisher.publish_to_webplatform("Other", "hi", "appt-1")
    assert ok is False


@pytest.mark.asyncio
@respx.mock
async def test_publish_http_error_returns_false(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    respx.post(f"{publisher.WEBPLATFORM_URL}/api/notes").mock(
        return_value=httpx.Response(500, text="oops")
    )
    ok = await publisher.publish_to_webplatform("Note", "hi", "appt-1")
    assert ok is False


@pytest.mark.asyncio
@respx.mock
async def test_publish_network_error_returns_false(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    respx.post(f"{publisher.WEBPLATFORM_URL}/api/notes").mock(
        side_effect=httpx.ConnectError("boom")
    )
    ok = await publisher.publish_to_webplatform("Note", "hi", "appt-1")
    assert ok is False
