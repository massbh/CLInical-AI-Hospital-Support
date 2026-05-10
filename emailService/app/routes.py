from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import db
from app.auth import verify_api_key
from app.service import ReportNotFound, send_report_email

router = APIRouter()


class SendReportRequest(BaseModel):
    report_id: str = Field(
        ...,
        description="UUID of the report to send.",
        examples=["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
    )


class SendReportResponse(BaseModel):
    success: bool
    recipient: str


@router.post(
    "/send-report",
    response_model=SendReportResponse,
    summary="Manually send a report by id (mirrors what the scheduler does)",
)
def send_report(
    body: SendReportRequest,
    _: str = Depends(verify_api_key),
) -> SendReportResponse:
    try:
        recipient = send_report_email(body.report_id)
    except ReportNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    except Exception as exc:
        db.mark_failed(body.report_id, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send email: {exc}",
        )

    db.mark_sent(body.report_id)
    return SendReportResponse(success=True, recipient=recipient)
