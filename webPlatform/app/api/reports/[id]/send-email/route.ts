import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Send a report via email
 * Requires all sections to be accepted and PDF to be generated
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;
    const { recipient_email, subject, message } = await request.json();

    if (!recipient_email) {
      return NextResponse.json(
        { error: "recipient_email is required" },
        { status: 400 }
      );
    }

    // Check if report can be sent
    const checkResponse = await fetch(
      `http://localhost:3000/api/reports/${reportId}/can-send-email`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const checkData = await checkResponse.json();

    if (!checkData.can_send_email) {
      return NextResponse.json(
        {
          error: "Report is not ready to send",
          reasons: checkData.reasons_if_not_ready,
        },
        { status: 400 }
      );
    }

    // Get report details
    const reportResult = await pool.query(
      `SELECT id, patient_name, patient_surname, doctor_name, title, date 
       FROM reports WHERE id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const report = reportResult.rows[0];

    // Call emailService to send the email
    // This assumes emailService is running on port 8001
    const emailPayload = {
      to: recipient_email,
      subject: subject || `Medical Report: ${report.title}`,
      template: "report_submission",
      variables: {
        patient_name: report.patient_name,
        patient_surname: report.patient_surname,
        doctor_name: report.doctor_name,
        report_title: report.title,
        report_date: report.date,
        message: message || `Please find your medical report attached.`,
      },
      attachments: [
        {
          filename: `report_${reportId}.pdf`,
          path: `/app/reports/report_${reportId}.pdf`, // Path on emailService server
        },
      ],
    };

    const emailResponse = await fetch("http://localhost:8001/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.EMAIL_SERVICE_API_KEY || "dev-key",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      return NextResponse.json(
        {
          error: error.detail || "Failed to send email",
          email_service_error: error,
        },
        { status: emailResponse.status }
      );
    }

    const emailData = await emailResponse.json();

    // Log the email sending in database
    await pool.query(
      `INSERT INTO email_logs (report_id, recipient_email, status, sent_at)
       VALUES ($1, $2, $3, NOW())`,
      [reportId, recipient_email, "sent"]
    );

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${recipient_email}`,
      report_id: reportId,
      recipient_email: recipient_email,
      email_service_response: emailData,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
