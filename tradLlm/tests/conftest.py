import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("OLLAMA_URL", "http://ollama.test/api/generate")
os.environ.setdefault("OLLAMA_MODEL", "test-model")
os.environ.setdefault("MEDBRAIN_URL", "http://medbrain.test")
os.environ.setdefault("BATCHING_URL", "http://batching.test/next-batch")
os.environ.setdefault("BATCHING_RESET_URL", "http://batching.test/reset")
os.environ.setdefault("SESSION_POLL_INTERVAL_S", "0.01")


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAD_LLM_BATCH_LOG_FILE", str(tmp_path / "batches.jsonl"))
    # reload modules so the env var is picked up
    import importlib
    from app import batch_log
    importlib.reload(batch_log)
    from app import main as app_main
    importlib.reload(app_main)
    return TestClient(app_main.app)
