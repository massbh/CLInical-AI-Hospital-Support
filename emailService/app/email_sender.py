import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str,
    attachments: list[tuple[str, bytes]] | None = None,
) -> None:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", user or "noreply@clinical.local")
    is_tls_enabled = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    outer = MIMEMultipart("mixed")
    outer["Subject"] = subject
    outer["From"] = from_addr
    outer["To"] = to

    body = MIMEMultipart("alternative")
    body.attach(MIMEText(text, "plain"))
    body.attach(MIMEText(html, "html"))
    outer.attach(body)

    for filename, data in attachments or []:
        part = MIMEApplication(data, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=filename)
        outer.attach(part)

    with smtplib.SMTP(host, port) as smtp:
        if is_tls_enabled:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(from_addr, to, outer.as_string())
