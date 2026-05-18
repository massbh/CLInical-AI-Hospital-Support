import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
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

    const appointmentResult = await procedures.reportGetAppointmentDetails(appointmentId);

    if (appointmentResult.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const { patient_id, doctor_account_id } = appointmentResult[0];
    if (!doctor_account_id) {
      return NextResponse.json(
        { error: "Doctor has no linked account" },
        { status: 500 }
      );
    }

    const notesResult = await procedures.reportGetNotesByAppointment(appointmentId);
    const suggestionsResult = await procedures.reportGetSuggestionsByAppointment(appointmentId);

    const reportResult = await procedures.reportCreate(
      patient_id,
      doctor_account_id,
      patient_name,
      patient_surname,
      doctor_name,
      title || "Medical Consultation Report"
    );

    const reportId = reportResult[0].id;

    const sectionSchema = await structureReportSections(
      notesResult.map((note) => note.content),
      suggestionsResult.map((suggestion) => suggestion.content)
    );

    for (const section of sectionSchema) {
      await procedures.reportSectionUpsert(
        reportId,
        section.title,
        section.content,
        "pending"
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
