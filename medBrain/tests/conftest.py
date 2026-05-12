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
os.environ.setdefault("WEBPLATFORM_URL", "http://webplatform.test")


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)
