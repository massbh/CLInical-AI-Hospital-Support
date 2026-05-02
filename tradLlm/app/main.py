from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from app.batch_log import log_sent_batch, read_sent_batches
from app.llm_gate import generate_question_from_batch, read_next_batch
from app.medbrain_gate import forward_to_medbrain
from app.session import list_sessions, start_session, stop_session


load_dotenv()

app = FastAPI(
    title="Trad LLM - Question Generation Gate",
    description=(
        "Receives transcript batches from the batching module, generates a "
        "question, and forwards it to Med Brain so the Note or Suggestion "
        "lands in the webPlatform DB."
    ),
    version="0.2.0",
)


class QuestionGenerationRequest(BaseModel):
    batch: str = Field(
        ...,
        min_length=1,
        description="Transcript batch string produced by the existing batching module.",
        examples=["Patient says the pain started yesterday and gets worse when breathing."],
    )
    appointment_id: str = Field(
        ...,
        min_length=1,
        description="Appointment UUID the resulting medBrain output should be tied to.",
        examples=["cccc0000-0000-0000-0000-000000000001"],
    )


class FromBatchingRequest(BaseModel):
    appointment_id: str = Field(
        ...,
        min_length=1,
        description="Appointment UUID the resulting medBrain output should be tied to.",
        examples=["cccc0000-0000-0000-0000-000000000001"],
    )


class QuestionGenerationResponse(BaseModel):
    question: str = Field(description="Question generated from the transcript batch.")
    medbrain_published: bool = Field(
        default=False,
        description="Whether medBrain accepted the question and published the result.",
    )
    medbrain_error: str | None = Field(
        default=None,
        description="Error message when forwarding to medBrain failed; null on success.",
    )


class SentBatchRecord(BaseModel):
    created_at: str
    source: str
    batch: str
    question: str


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


async def _generate_and_forward(
    batch: str,
    appointment_id: str,
    log_source: str,
) -> QuestionGenerationResponse:
    question = await generate_question_from_batch(batch)
    log_sent_batch(batch, question, source=log_source)

    published = False
    error_msg: str | None = None
    try:
        result = await forward_to_medbrain(question, appointment_id)
        published = bool(result.get("published"))
    except Exception as exc:
        error_msg = str(exc)

    return QuestionGenerationResponse(
        question=question,
        medbrain_published=published,
        medbrain_error=error_msg,
    )


@app.post(
    "/question-generation",
    response_model=QuestionGenerationResponse,
    summary="Generate a medical LLM question from a transcript batch",
    description=(
        "Accepts a batch string and appointment_id, generates a question via "
        "Ollama, logs it, and forwards it to medBrain for validation + DB write."
    ),
)
async def generate_question(
    body: QuestionGenerationRequest,
) -> QuestionGenerationResponse:
    try:
        return await _generate_and_forward(
            batch=body.batch,
            appointment_id=body.appointment_id,
            log_source="request",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama unreachable or returned an unexpected error: {exc}",
        )


@app.post(
    "/question-generation/from-batching",
    response_model=QuestionGenerationResponse,
    summary="Read the next batch and generate a medical LLM question",
    description=(
        "Pulls the next batch from the batching module, generates a question, "
        "and forwards it to medBrain for validation + DB write."
    ),
)
async def generate_question_from_next_batch(
    body: FromBatchingRequest,
) -> QuestionGenerationResponse:
    try:
        batch = await read_next_batch()
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No batch is currently available.",
            )

        return await _generate_and_forward(
            batch=batch,
            appointment_id=body.appointment_id,
            log_source="batching",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Batching or Ollama endpoint returned an unexpected error: {exc}",
        )


class SessionRequest(BaseModel):
    appointment_id: str = Field(
        ...,
        min_length=1,
        description="Appointment UUID to start or stop streaming for.",
        examples=["cccc0000-0000-0000-0000-000000000001"],
    )


class SessionResponse(BaseModel):
    appointment_id: str
    started: bool = False
    stopped: bool = False
    already_running: bool = False
    not_running: bool = False


@app.post(
    "/session/start",
    response_model=SessionResponse,
    summary="Start streaming an appointment to medBrain",
    description=(
        "Spawns a background loop that pulls transcript batches from the "
        "eavesdropper batching service, generates questions, and forwards "
        "them to medBrain so each Note or Suggestion is published to the DB."
    ),
)
async def session_start(
    body: SessionRequest,
) -> SessionResponse:
    started = await start_session(body.appointment_id)
    return SessionResponse(
        appointment_id=body.appointment_id,
        started=started,
        already_running=not started,
    )


@app.post(
    "/session/stop",
    response_model=SessionResponse,
    summary="Stop streaming an appointment",
)
async def session_stop(
    body: SessionRequest,
) -> SessionResponse:
    stopped = await stop_session(body.appointment_id)
    return SessionResponse(
        appointment_id=body.appointment_id,
        stopped=stopped,
        not_running=not stopped,
    )


@app.get(
    "/session",
    summary="List active streaming sessions",
)
async def session_list(
) -> dict[str, list[str]]:
    return {"appointment_ids": list_sessions()}


@app.get(
    "/question-generation/batches",
    response_model=list[SentBatchRecord],
    summary="Read batches sent for question generation",
    description="Returns the latest transcript batches sent through the question-generation gateway.",
)
async def list_sent_batches(
    limit: int = 50,
) -> list[SentBatchRecord]:
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 500",
        )

    return read_sent_batches(limit=limit)
