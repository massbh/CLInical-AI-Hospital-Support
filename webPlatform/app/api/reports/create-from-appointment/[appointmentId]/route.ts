import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { structureReportWithTradLlm } from "@/lib/tradllm";

const REPORT_SECTION_TITLES = [
  "Vital Signs",
  "Physical Examination",
  "Diagnosis",
  "Recommendations",
  "Assessment & Plan",
] as const;

type ReportSectionTitle = (typeof REPORT_SECTION_TITLES)[number];
type ReportSection = { title: ReportSectionTitle; content: string };

function emptySections(): Record<ReportSectionTitle, string> {
  return REPORT_SECTION_TITLES.reduce((acc, title) => {
    acc[title] = "";
    return acc;
  }, {} as Record<ReportSectionTitle, string>);
}

function normalizeSections(sections: Partial<Record<string, unknown>>): ReportSection[] {
  const normalized = emptySections();

  for (const title of REPORT_SECTION_TITLES) {
    const value = sections[title];
    normalized[title] = typeof value === "string" ? value.trim() : "";
  }

  return REPORT_SECTION_TITLES.map((title) => ({
    title,
    content: normalized[title],
  }));
}

function fallbackSections(notes: string[], suggestions: string[]): ReportSection[] {
  const sections = emptySections();
  const noteLines = notes
    .flatMap((note) => note.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);

  const vitalLines: string[] = [];
  const recommendationLines: string[] = [];
  const diagnosisLines: string[] = [];
  const remainingLines: string[] = [];

  for (const line of noteLines) {
    if (/\b(bp|blood pressure|hr|heart rate|pulse|temp|temperature|spo2|oxygen saturation|respiratory rate|rr)\b/i.test(line)) {
      vitalLines.push(line);
    } else if (/\b(recommend|consider|obtain|order|refer|monitor|check|start|stop|follow up|follow-up)\b/i.test(line)) {
      recommendationLines.push(line);
    } else if (/\b(diagnos|consistent with|concerning for|likely|suggestive of|assessment)\b/i.test(line)) {
      diagnosisLines.push(line);
    } else {
      remainingLines.push(line);
    }
  }

  recommendationLines.push(
    ...suggestions.map((suggestion) => suggestion.trim()).filter(Boolean)
  );

  sections["Vital Signs"] = vitalLines.join("\n\n");
  sections["Diagnosis"] = diagnosisLines.join("\n\n");
  sections["Recommendations"] = recommendationLines.join("\n\n");
  sections["Assessment & Plan"] = remainingLines.join("\n\n");

  return normalizeSections(sections);
}

async function structureReportSections(
  notes: string[],
  suggestions: string[]
): Promise<ReportSection[]> {
  if (![...notes, ...suggestions].some((item) => item.trim())) {
    return normalizeSections({});
  }

  try {
    const result = await structureReportWithTradLlm(notes, suggestions);
    if (!result.ok) {
      console.error("tradLlm report structure failed:", result.status);
      return fallbackSections(notes, suggestions);
    }

    return normalizeSections(
      Object.fromEntries(
        result.sections.map((section) => [section.title, section.content])
      )
    );
  } catch (error) {
    console.error("tradLlm unavailable, using fallback sections:", error);
    return fallbackSections(notes, suggestions);
  }
}

/**
 * Create a report from an appointment with initial sections from notes
 * Auto-populates sections from conversation notes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params;
    const { patient_name, patient_surname, doctor_name, title } =
      await request.json();

    if (!patient_name || !patient_surname || !doctor_name) {
      return NextResponse.json(
        {
          error:
            "patient_name, patient_surname, and doctor_name are required",
        },
        { status: 400 }
      );
    }

    // booked_appointments.doctor_id references doctors(id), but
    // reports.doctor_id references accounts(id). Translate via the doctor's
    // account_id so the FK on reports is satisfied.
    const appointmentResult = await pool.query(
      `SELECT ba.patient_id, d.account_id AS doctor_account_id
       FROM booked_appointments ba
       JOIN doctors d ON d.id = ba.doctor_id
       WHERE ba.id = $1`,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const { patient_id, doctor_account_id } = appointmentResult.rows[0];
    if (!doctor_account_id) {
      return NextResponse.json(
        { error: "Doctor has no linked account" },
        { status: 500 }
      );
    }

    // Get notes and suggestions from this appointment to use as report inputs.
    const notesResult = await pool.query(
      `SELECT id, content FROM notes WHERE appointment_id = $1 ORDER BY timestamp ASC`,
      [appointmentId]
    );
    const suggestionsResult = await pool.query(
      `SELECT id, description AS content
       FROM suggestions
       WHERE appointment_id = $1
       ORDER BY timestamp ASC`,
      [appointmentId]
    );

    const notes = notesResult.rows;
    const suggestions = suggestionsResult.rows;

    // Create the report
    const reportResult = await pool.query(
      `INSERT INTO reports (patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, preview)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, NULL)
       RETURNING id`,
      [patient_id, doctor_account_id, patient_name, patient_surname, doctor_name, title || "Medical Consultation Report"]
    );

    const reportId = reportResult.rows[0].id;

    const sectionSchema = await structureReportSections(
      notes.map((note) => note.content),
      suggestions.map((suggestion) => suggestion.content)
    );

    for (const section of sectionSchema) {
      await pool.query(
        `INSERT INTO report_sections (report_id, title, content, status)
         VALUES ($1, $2, $3, $4)`,
        [reportId, section.title, section.content, "pending"]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Report created from appointment notes",
      report_id: reportId,
      sections_created: sectionSchema.length,
      patient_name,
      patient_surname,
      doctor_name,
    });
  } catch (error) {
    console.error("Error creating report from appointment:", error);
    return NextResponse.json(
      { error: "Failed to create report from appointment" },
      { status: 500 }
    );
  }
}
