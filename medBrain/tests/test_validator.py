from validator.response_validator import validate_llm_response


def test_valid_note_passes():
    result = validate_llm_response("<Note>BP 120/80, stable.</Note>")
    assert result.is_valid
    assert result.kind == "Note"
    assert result.msg == "BP 120/80, stable."


def test_keyword_filter_rejects_ai_disclaimer():
    raw = "<Note>As an AI, I think the patient is fine.</Note>"
    result = validate_llm_response(raw)
    assert not result.is_valid
    assert result.error_type == "keyword-error"


def test_parse_failure_propagates():
    result = validate_llm_response("plain text no tags")
    assert not result.is_valid
    assert result.error_type == "parse_error"


def test_valid_with_suggestion():
    raw = "<Note>Cough x3 days.</Note><Suggestion>Order chest x-ray.</Suggestion>"
    result = validate_llm_response(raw)
    assert result.is_valid
    assert len(result.items) == 2
