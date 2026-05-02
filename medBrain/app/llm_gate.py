import os
from datetime import datetime

import httpx

from app.system_prompt import SYSTEM_PROMPT


OLLAMA_URL = os.getenv(
    "OLLAMA_URL", "http://localhost:11434/api/generate"
)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "medllama2")
def _log_exchange(question: str, response: str) -> None:
    """Print the input question and the final Ollama response to stdout.
    Called only after a successful (non-streamed) generate call."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(
        f"===== {timestamp} | model={OLLAMA_MODEL} =====\n"
        f"--- IN ---\n{question}\n"
        f"--- OUT ---\n{response}\n",
        flush=True,
    )


async def ask_medical_llm(question: str) -> str:
    """
    Forwards a question to the medical LLM via Ollama's /api/generate
    endpoint. The validator parses the raw response.
    """
    async with httpx.AsyncClient(timeout=6000.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": question,
                "stream": False,
            },
        )
        response.raise_for_status()
        data = response.json()
        text = data.get("response", "")

    _log_exchange(question, text)
    return text
