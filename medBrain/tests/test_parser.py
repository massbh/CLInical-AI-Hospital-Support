from validator.parser import parse_llm_output


def test_parses_single_note():
    result = parse_llm_output("<Note>Patient stable.</Note>")
    assert result.is_parsed
    assert result.type == "Note"
    assert result.msg == "Patient stable."
    assert result.items == [("Note", "Patient stable.")]


def test_parses_note_and_suggestion_orders_note_first():
    raw = "<Suggestion>Order ECG.</Suggestion><Note>Chest pain reported.</Note>"
    result = parse_llm_output(raw)
    assert result.is_parsed
    assert result.items[0][0] == "Note"
    assert result.items[1][0] == "Suggestion"
    assert result.type == "Note"


def test_rejects_text_outside_tags():
    result = parse_llm_output("Sure! <Note>Hi.</Note>")
    assert not result.is_parsed
    assert "outside" in result.parse_error.lower()


def test_rejects_missing_note():
    result = parse_llm_output("<Suggestion>Hydrate</Suggestion>")
    assert not result.is_parsed
    assert "exactly one Note" in result.parse_error


def test_rejects_multiple_notes():
    raw = "<Note>One</Note><Note>Two</Note>"
    result = parse_llm_output(raw)
    assert not result.is_parsed


def test_rejects_multiple_suggestions():
    raw = "<Note>A</Note><Suggestion>B</Suggestion><Suggestion>C</Suggestion>"
    result = parse_llm_output(raw)
    assert not result.is_parsed
    assert "at most one Suggestion" in result.parse_error


def test_rejects_empty_tag():
    result = parse_llm_output("<Note>   </Note>")
    assert not result.is_parsed
    assert "empty" in result.parse_error.lower()


def test_rejects_no_tags():
    result = parse_llm_output("just some prose")
    assert not result.is_parsed
