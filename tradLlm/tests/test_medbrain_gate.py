import httpx
import pytest
import respx

from app import medbrain_gate


@pytest.mark.asyncio
@respx.mock
async def test_forward_to_medbrain_success():
    respx.post("http://medbrain.test/ask").mock(
        return_value=httpx.Response(200, json={"published": True, "kind": "Note"})
    )
    result = await medbrain_gate.forward_to_medbrain("q?", "appt-1")
    assert result["published"] is True


@pytest.mark.asyncio
@respx.mock
async def test_forward_to_medbrain_raises_on_error():
    respx.post("http://medbrain.test/ask").mock(return_value=httpx.Response(502))
    with pytest.raises(httpx.HTTPStatusError):
        await medbrain_gate.forward_to_medbrain("q", "a")
