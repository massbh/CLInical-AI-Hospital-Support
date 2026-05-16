import importlib
import json


def test_log_and_read_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAD_LLM_BATCH_LOG_FILE", str(tmp_path / "b.jsonl"))
    from app import batch_log
    importlib.reload(batch_log)

    batch_log.log_sent_batch("transcript-1", "Q1?", source="request")
    batch_log.log_sent_batch("transcript-2", "Q2?", source="session:abc")

    records = batch_log.read_sent_batches(limit=10)
    assert [r["batch"] for r in records] == ["transcript-1", "transcript-2"]
    assert records[0]["source"] == "request"
    assert records[1]["question"] == "Q2?"
    assert "created_at" in records[0]


def test_read_returns_empty_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAD_LLM_BATCH_LOG_FILE", str(tmp_path / "missing.jsonl"))
    from app import batch_log
    importlib.reload(batch_log)
    assert batch_log.read_sent_batches() == []


def test_limit_returns_tail(tmp_path, monkeypatch):
    path = tmp_path / "b.jsonl"
    monkeypatch.setenv("TRAD_LLM_BATCH_LOG_FILE", str(path))
    from app import batch_log
    importlib.reload(batch_log)

    for i in range(5):
        batch_log.log_sent_batch(f"b{i}", f"q{i}", source="s")

    tail = batch_log.read_sent_batches(limit=2)
    assert [r["batch"] for r in tail] == ["b3", "b4"]


def test_log_writes_valid_json_lines(tmp_path, monkeypatch):
    path = tmp_path / "b.jsonl"
    monkeypatch.setenv("TRAD_LLM_BATCH_LOG_FILE", str(path))
    from app import batch_log
    importlib.reload(batch_log)
    batch_log.log_sent_batch("hi", "q", source="t")

    lines = path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    parsed = json.loads(lines[0])
    assert parsed["batch"] == "hi"
