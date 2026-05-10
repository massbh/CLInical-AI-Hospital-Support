import json
import os
import re

import httpx


REPORT_SECTION_TITLES = (
    "Vital Signs",
    "Physical Examination",
    "Diagnosis",
    "Recommendations",
    "Assessment & Plan",
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
REPORT_LLM_MODEL = os.getenv(
    "REPORT_LLM_MODEL",
    os.getenv("TRAD_LLM_MODEL", os.getenv("OLLAMA_MODEL", "llama3.1:latest")),
)


def empty_sections() -> dict[str, str]:
    return {title: "" for title in REPORT_SECTION_TITLES}


def normalize_sections(sections: dict | None) -> dict[str, str]:
    normalized = empty_sections()
    if not sections:
        return normalized

    for title in REPORT_SECTION_TITLES:
        value = sections.get(title)
        normalized[title] = value.strip() if isinstance(value, str) else ""

    return normalized


def extract_json_object(text: str) -> dict | None:
    stripped = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", stripped, re.I)
    candidate = fenced.group(1) if fenced else stripped
    start = candidate.find("{")
    end = candidate.rfind("}")

    if start == -1 or end == -1 or end <= start:
        return None

    try:
        parsed = json.loads(candidate[start : end + 1])
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def fallback_sections(notes: list[str], suggestions: list[str]) -> dict[str, str]:
    sections = empty_sections()
    diagnosis_lines: list[str] = []
    recommendation_lines: list[str] = []
    vital_lines: list[str] = []
    assessment_lines: list[str] = []

    for line in [item.strip() for item in notes if item.strip()]:
        if re.search(
            r"\b(bp|blood pressure|hr|heart rate|pulse|temp|temperature|"
            r"spo2|oxygen saturation|respiratory rate|rr)\b",
            line,
            re.I,
        ):
            vital_lines.append(line)
        elif re.search(
            r"\b(diagnos|consistent with|concerning for|likely|"
            r"suggestive of|assessment)\b",
            line,
            re.I,
        ):
            diagnosis_lines.append(line)
        else:
            assessment_lines.append(line)

    recommendation_lines.extend(item.strip() for item in suggestions if item.strip())

    sections["Vital Signs"] = "\n\n".join(vital_lines)
    sections["Diagnosis"] = "\n\n".join(diagnosis_lines)
    sections["Recommendations"] = "\n\n".join(recommendation_lines)
    sections["Assessment & Plan"] = "\n\n".join(assessment_lines)
    return sections


def classify_note_section(note: str) -> str:
    if re.search(
        r"\b(bp|blood pressure|hr|heart rate|pulse|temp|temperature|spo2|"
        r"oxygen saturation|respiratory rate|rr)\b",
        note,
        re.I,
    ):
        return "Vital Signs"
    if re.search(
        r"\b(diagnos|consistent with|concerning for|likely|suggestive of|"
        r"assessment)\b",
        note,
        re.I,
    ):
        return "Diagnosis"
    if re.search(
        r"\b(recommend|consider|obtain|order|refer|monitor|check|start|stop|"
        r"follow up|follow-up)\b",
        note,
        re.I,
    ):
        return "Recommendations"
    return "Assessment & Plan"


def append_unique(existing: str, addition: str) -> str:
    addition = addition.strip()
    if not addition:
        return existing

    if addition.lower() in existing.lower():
        return existing

    return f"{existing.strip()}\n\n{addition}".strip()


def all_section_text(sections: dict[str, str]) -> str:
    return "\n\n".join(sections.values()).lower()


def ensure_source_coverage(
    sections: dict[str, str],
    notes: list[str],
    suggestions: list[str],
) -> dict[str, str]:
    covered_text = all_section_text(sections)

    for note in [item.strip() for item in notes if item.strip()]:
        if note.lower() in covered_text:
            continue

        title = classify_note_section(note)
        sections[title] = append_unique(sections[title], note)
        covered_text = all_section_text(sections)

    for suggestion in [item.strip() for item in suggestions if item.strip()]:
        if suggestion.lower() in covered_text:
            continue

        sections["Recommendations"] = append_unique(
            sections["Recommendations"],
            suggestion,
        )
        covered_text = all_section_text(sections)

    return sections


def build_prompt(notes: list[str], suggestions: list[str]) -> str:
    notes_text = "\n".join(f"- {note}" for note in notes if note.strip())
    suggestions_text = "\n".join(
        f"- {suggestion}" for suggestion in suggestions if suggestion.strip()
    )

    return f"""You structure clinical appointment outputs into a medical report.

Return ONLY valid JSON. No markdown. No extra text.

Required JSON keys:
{{
  "Vital Signs": "",
  "Physical Examination": "",
  "Diagnosis": "",
  "Recommendations": "",
  "Assessment & Plan": ""
}}

Rules:
- Use the supplied Notes and Suggestions. Do not ignore either source.
- Use only supplied information. Do not invent facts.
- Put vital signs only in "Vital Signs".
- Put exam findings only in "Physical Examination".
- Put diagnoses, suspected diagnoses, and clinical impressions in "Diagnosis".
- Put suggested tests, treatments, referrals, monitoring, safety steps, and
  follow-up in "Recommendations".
- Put the core narrative summary and plan synthesis in "Assessment & Plan".
- Leave unsupported sections empty.
- Do not place every item in one section.

Notes:
{notes_text or "- None"}

Suggestions:
{suggestions_text or "- None"}"""


async def structure_report(notes: list[str], suggestions: list[str]) -> dict[str, str]:
    if not any(item.strip() for item in notes + suggestions):
        return empty_sections()

    prompt = build_prompt(notes, suggestions)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": REPORT_LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0},
                },
            )
            response.raise_for_status()
            raw = response.json().get("response", "")

        parsed = extract_json_object(raw if isinstance(raw, str) else "")
        if parsed:
            sections = normalize_sections(parsed)
            return ensure_source_coverage(sections, notes, suggestions)
    except Exception:
        pass

    sections = normalize_sections(fallback_sections(notes, suggestions))
    return ensure_source_coverage(sections, notes, suggestions)
