// Server-side helper for proxying session start/stop calls to the tradLlm
// service. Keeps the API key out of the browser.

const TRADLLM_URL = process.env.TRADLLM_URL ?? "http://localhost:8002";
const TRADLLM_API_KEY = process.env.TRADLLM_API_KEY ?? "";

export async function callTradLlmSession(
  action: "start" | "stop",
  appointmentId: string
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${TRADLLM_URL}/session/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-Key": TRADLLM_API_KEY,
    },
    body: JSON.stringify({ appointment_id: appointmentId }),
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { ok: response.ok, status: response.status, body };
}
