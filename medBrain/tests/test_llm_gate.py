import httpx
import pytest
import respx

from app import llm_gate


@pytest.mark.asyncio
@respx.mock
async def test_ask_medical_llm_posts_expected_payload_and_returns_response():
    route = respx.post(llm_gate.OLLAMA_URL).mock(
        return_value=httpx.Response(200, json={"response": "<Note>ok</Note>"})
    )

    text = await llm_gate.ask_medical_llm("question")
    assert text == "<Note>ok</Note>"
    assert route.called
    body = route.calls.last.request.read()
    assert b'"prompt":"question"' in body or b'"prompt": "question"' in body
    assert b"stream" in body


@pytest.mark.asyncio
@respx.mock
async def test_ask_medical_llm_raises_on_http_error():
    respx.post(llm_gate.OLLAMA_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        await llm_gate.ask_medical_llm("q")
