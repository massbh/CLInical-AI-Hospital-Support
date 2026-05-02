import os
from datetime import datetime

import httpx

from app.system_prompt import SYSTEM_PROMPT


OLLAMA_URL = os.getenv(
    "OLLAMA_URL", "http://localhost:11434/api/generate"
)
OLLAMA_MODEL = os.getenv("TRAD_LLM_MODEL", os.getenv("OLLAMA_MODEL", "llama3.1"))
BATCHING_URL = os.getenv("BATCHING_URL", "http://127.0.0.1:8000/next-batch")
def _log_exchange(batch: str, question: str) -> None:
    """Print the input batch and the final Ollama response to stdout.
    Called only after a successful (non-streamed) generate call."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(
        f"===== {timestamp} | model={OLLAMA_MODEL} =====\n"
        f"--- IN ---\n{batch}\n"
        f"--- OUT ---\n{question}\n",
        flush=True,
    )


async def generate_question_from_batch(batch: str) -> str:
    """
    Forwards a transcript batch to Ollama via /api/generate with the
    question-generation system prompt and returns one generated question.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": batch,
                "stream": False,
            },
        )
        response.raise_for_status()
        data = response.json()
        question = data.get("response", "").strip()

    _log_exchange(batch, question)
    return question


async def read_next_batch() -> str:
    """
    Reads the next available batch from the existing batching module endpoint.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(BATCHING_URL)
        response.raise_for_status()

    if response.headers.get("content-type", "").startswith("application/json"):
        data = response.json()
        if isinstance(data, str):
            return data
        if isinstance(data, dict) and isinstance(data.get("batch"), str):
            return data["batch"]

    return response.text.strip().strip('"')
