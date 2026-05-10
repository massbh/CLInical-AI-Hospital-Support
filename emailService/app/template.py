from html import escape


def build_email(report: dict) -> tuple[str, str, str]:
    subject = (
        f"Medical Report – {report['patient_name']} {report['patient_surname']}"
        f" – {report['date']}"
    )
    return subject, _build_html(report), _build_text(report)


def _build_html(report: dict) -> str:
    patient = escape(report["patient_name"])
    date = escape(str(report["date"]))
    doctor = escape(report["doctor_name"])
    return f"""<html><body>
<p>Hi {patient},</p>
<p>Attached you can see the report from your appointment on {date}.</p>
<p>Best regards,<br><strong>Dr. {doctor}</strong><br>CLInical Hospital Support</p>
</body></html>"""


def _build_text(report: dict) -> str:
    return (
        f"Hi {report['patient_name']},\n\n"
        f"Attached you can see the report from your appointment on {report['date']}.\n\n"
        f"Best regards,\nDr. {report['doctor_name']}\nCLInical Hospital Support\n"
    )
