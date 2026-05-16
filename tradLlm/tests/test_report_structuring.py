import httpx
import pytest
import respx

from app import report_structuring as rs


def test_empty_sections_keys():
    s = rs.empty_sections()
    assert set(s.keys()) == set(rs.REPORT_SECTION_TITLES)
    assert all(v == "" for v in s.values())


def test_extract_json_object_fenced():
    text = '```json\n{"Vital Signs": "BP 120/80"}\n```'
    parsed = rs.extract_json_object(text)
    assert parsed == {"Vital Signs": "BP 120/80"}


def test_extract_json_object_returns_none_on_garbage():
    assert rs.extract_json_object("nope no braces") is None


def test_classify_note_section():
    assert rs.classify_note_section("BP 130/90") == "Vital Signs"
    assert rs.classify_note_section("consistent with viral pneumonia") == "Diagnosis"
    assert rs.classify_note_section("recommend chest x-ray") == "Recommendations"
    assert rs.classify_note_section("Patient says feels weak today") == "Assessment & Plan"


def test_fallback_sections_routes_correctly():
    notes = ["BP 140/95", "consistent with hypertension", "Patient feels tired"]
    suggestions = ["Monitor BP daily"]
    s = rs.fallback_sections(notes, suggestions)
    assert "BP 140/95" in s["Vital Signs"]
    assert "hypertension" in s["Diagnosis"]
    assert "feels tired" in s["Assessment & Plan"]
    assert "Monitor BP daily" in s["Recommendations"]


def test_append_unique_skips_duplicates():
    out = rs.append_unique("First note.", "first note.")
    assert out == "First note."
    out2 = rs.append_unique("First.", "Second.")
    assert "First." in out2 and "Second." in out2


@pytest.mark.asyncio
async def test_structure_report_empty_inputs_returns_empty():
    s = await rs.structure_report([], [])
    assert s == rs.empty_sections()


@pytest.mark.asyncio
@respx.mock
async def test_structure_report_uses_llm_response():
    respx.post(rs.OLLAMA_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "response": '{"Vital Signs":"BP 120/80","Physical Examination":"",'
                '"Diagnosis":"Healthy","Recommendations":"Hydrate","Assessment & Plan":""}'
            },
        )
    )
    out = await rs.structure_report(["BP 120/80"], ["Hydrate"])
    assert "BP 120/80" in out["Vital Signs"]
    assert "Healthy" in out["Diagnosis"]
    assert "Hydrate" in out["Recommendations"]


@pytest.mark.asyncio
@respx.mock
async def test_structure_report_falls_back_when_llm_errors():
    respx.post(rs.OLLAMA_URL).mock(side_effect=httpx.ConnectError("down"))
    out = await rs.structure_report(["BP 110/70"], ["Recheck in 2 weeks"])
    # fallback should at least put vitals + suggestions in correct buckets
    assert "BP 110/70" in out["Vital Signs"]
    assert "Recheck in 2 weeks" in out["Recommendations"]
