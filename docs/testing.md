# Testing

Test suites for the three core modules. All tests run offline — outbound HTTP is
mocked (`respx` for Python, `jest.mock` for the webPlatform). No Ollama, no
Postgres, no webPlatform server is required.

| Module | Framework | Tests | Location |
| --- | --- | --- | --- |
| `medBrain` | pytest + respx | 24 | `medBrain/tests/` |
| `tradLlm` | pytest + respx | 22 | `tradLlm/tests/` |
| `webPlatform` | Jest (`next/jest`) | 32 | `webPlatform/__tests__/` |

## Running

### medBrain

```bash
cd medBrain
pip install -r requirements-dev.txt
pytest
```

### tradLlm

```bash
cd tradLlm
pip install -r requirements-dev.txt
pytest
```

### webPlatform

```bash
cd webPlatform
npm install
npm test           # one-shot
npm run test:watch # watch mode
```

## What is covered

### medBrain
- `validator/parser.py` — Note/Suggestion tag extraction, ordering, malformed input
- `validator/response_validator.py` — structural validation + bad-keyword filter
- `app/llm_gate.py` — Ollama request shape, HTTP error handling
- `app/publisher.py` — Note/Suggestion POST, unknown kind, HTTP and network errors (failures must never raise)
- `app/routes.py` — `/health`, `/ask` happy path, 3-attempt retry on invalid LLM output, 502 on LLM error, 422 on bad input

### tradLlm
- `app/llm_gate.py` — question generation + `read_next_batch` (json string / json object / plain text)
- `app/medbrain_gate.py` — forwarding success and HTTP error
- `app/batch_log.py` — append, tail-limit, missing-file behavior
- `app/session.py` — start/stop lifecycle, double-start rejection
- `app/report_structuring.py` — JSON extraction, section classification, fallback path when the LLM is unreachable

### webPlatform
- `lib/auth.ts` — JWT sign/verify roundtrip, tampered + garbage rejection
- `lib/db-auth.ts` — `getAuthUser` (cookie + Bearer header), `requireAuth` / `requireDoctor` / `requirePatient`
- `app/api/auth/login` and `signup` — happy paths, validation errors, 401 on bad credentials, 409 on duplicate email, doctor row insert
- `app/api/notes` — auth gating (401/403), `appointmentId` required, GET success, POST insert, 500 on DB error
- `app/api/suggestions` — POST insert, title derivation + 80-char ellipsis truncation, default priority

## Conventions

- **No live network in tests.** `respx` and `jest.mock` raise on unhandled
  requests — if a new test hits the real network, add a mock for it.
- **No live database in tests.** `lib/db` is mocked via `jest.mock`; a separate
  E2E layer (Playwright + Postgres) is the right place for real DB coverage and
  is intentionally out of scope here.
- **Filesystem isolation.** Tests that write logs (medBrain `publish_logs.txt`,
  tradLlm `sent_batches.jsonl`) use pytest's `tmp_path` and `monkeypatch` so the
  working tree stays clean.

## Out of scope (follow-up work)

- React component tests (`loginPage`, `appointmentBooking`, `reportEditor`) —
  need `jsdom` + `@testing-library/react`; deferred because of the large
  Radix/shadcn surface area.
- Playwright E2E for critical user flows (login, booking, report).
- CI wiring and coverage thresholds.
- Tests for `eavesdropper`, `emailService`, `reportGenerator`, `server`,
  `database`.
