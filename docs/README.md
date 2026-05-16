# HOW TO

See [testing.md](./testing.md) for how to run the medBrain, tradLlm, and
webPlatform test suites.


## Batching module

To run use `uvicorn main:app --reload` to see the reload in real-time
You can verify in the browser at `http://127.0.0.1:8000/next-batch`

### IMPORTANT
After each reload of the page a new batch appears! Keep in mind when fetching from the Trad LLM


## Trad LLM question-generation gateway

The question-generation gateway lives in `tradLlm` and stands in front of the
Ollama chat endpoint. It receives transcript batches from the existing batching
module and converts each batch into one question for the medical LLM in
`medBrain`.

Run Trad LLM from the `tradLlm` directory:

```bash
uvicorn app.main:app --reload --port 8001
```

Required request header for protected endpoints:

```txt
X-API-Key: <one of API_KEYS>
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_KEYS` | empty | Comma-separated API keys accepted by Trad LLM. |
| `OLLAMA_URL` | `http://localhost:11434/api/chat` | Ollama chat endpoint used by the Trad LLM gate. |
| `TRAD_LLM_MODEL` | `OLLAMA_MODEL` or `llama3.1` | Ollama model used to convert batches into questions. |
| `BATCHING_URL` | `http://127.0.0.1:8000/next-batch` | Existing batching module endpoint used by the pull endpoint. |
| `TRAD_LLM_BATCH_LOG_FILE` | `tradLlm/sent_batches.jsonl` | JSONL file storing batches sent through the gateway. |

### Endpoints

`POST /question-generation`

Accepts a batch string directly from the batching module caller.

```json
{
  "batch": "Patient says the pain started yesterday and gets worse when breathing."
}
```

Response:

```json
{
  "question": "When did the pain start, and does it worsen with breathing or movement?"
}
```

`POST /question-generation/from-batching`

Reads the next batch from `BATCHING_URL`, sends it to Ollama for question
generation, logs it, and returns the generated question.

`GET /question-generation/batches?limit=50`

Returns the latest batches sent through the question-generation gateway,
including the generated question and source.
