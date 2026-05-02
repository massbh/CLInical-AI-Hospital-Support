import os

import httpx


async def forward_to_medbrain(question: str, appointment_id: str) -> dict:
    """
    POST the generated question to medBrain's /ask endpoint with the
    appointment_id so medBrain can validate and publish the resulting
    Note or Suggestion to the webPlatform DB.
    """
    medbrain_url = os.getenv("MEDBRAIN_URL", "http://localhost:8001")
    timeout_s = float(os.getenv("MEDBRAIN_TIMEOUT_S", "60.0"))

    url = f"{medbrain_url.rstrip('/')}/ask"
    payload = {"question": question, "appointment_id": appointment_id}

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()
