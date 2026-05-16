import httpx
import pytest
import respx

from app import llm_gate


@pytest.mark.asyncio
@respx.mock
async def test_generate_question_returns_stripped_text():
    respx.post(llm_gate.OLLAMA_URL).mock(
        return_value=httpx.Response(200, json={"response": "  When did pain start?  "})
    )
    q = await llm_gate.generate_question_from_batch("transcript")
    assert q == "When did pain start?"


@pytest.mark.asyncio
@respx.mock
async def test_generate_question_raises_on_http_error():
    respx.post(llm_gate.OLLAMA_URL).mock(return_value=httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        await llm_gate.generate_question_from_batch("x")


@pytest.mark.asyncio
@respx.mock
async def test_read_next_batch_json_string():
    respx.get(llm_gate.BATCHING_URL).mock(
        return_value=httpx.Response(
            200, json="hello batch", headers={"content-type": "application/json"}
        )
    )
    assert await llm_gate.read_next_batch() == "hello batch"


@pytest.mark.asyncio
@respx.mock
async def test_read_next_batch_json_object():
    respx.get(llm_gate.BATCHING_URL).mock(
        return_value=httpx.Response(
            200, json={"batch": "obj batch"}, headers={"content-type": "application/json"}
        )
    )
    assert await llm_gate.read_next_batch() == "obj batch"


@pytest.mark.asyncio
@respx.mock
async def test_read_next_batch_plain_text():
    respx.get(llm_gate.BATCHING_URL).mock(
        return_value=httpx.Response(200, text='"plain text"', headers={"content-type": "text/plain"})
    )
    assert await llm_gate.read_next_batch() == "plain text"
