import httpx
import respx

from app import llm_gate, publisher


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@respx.mock
def test_ask_happy_path_publishes_note(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    respx.post(llm_gate.OLLAMA_URL).mock(
        return_value=httpx.Response(200, json={"response": "<Note>BP fine.</Note>"})
    )
    respx.post(f"{publisher.WEBPLATFORM_URL}/api/notes").mock(
        return_value=httpx.Response(201, json={"id": "n1"})
    )

    r = client.post("/ask", json={"question": "q", "appointment_id": "a1"})
    assert r.status_code == 200
    data = r.json()
    assert data["kind"] == "Note"
    assert data["published"] is True
    assert data["outputs"][0]["kind"] == "Note"


@respx.mock
def test_ask_invalid_response_retries_and_gives_up(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    route = respx.post(llm_gate.OLLAMA_URL).mock(
        return_value=httpx.Response(200, json={"response": "no tags here"})
    )

    r = client.post("/ask", json={"question": "q", "appointment_id": "a1"})
    assert r.status_code == 200
    assert r.json()["published"] is False
    # routes.py loops while attempt_number < 4 → 3 attempts
    assert route.call_count == 3


@respx.mock
def test_ask_llm_error_returns_502(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    respx.post(llm_gate.OLLAMA_URL).mock(return_value=httpx.Response(500))

    r = client.post("/ask", json={"question": "q", "appointment_id": "a1"})
    assert r.status_code == 502


def test_ask_validates_input(client):
    r = client.post("/ask", json={"question": "", "appointment_id": "a"})
    assert r.status_code == 422
