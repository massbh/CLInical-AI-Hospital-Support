from .parser import parse_llm_output, ParsedResponse
from .keywords import has_bad_keywords, get_triggered_keyword
from .validation_errors import ValidationResult, KEYWORD_ERROR, PARSE_ERROR


def validate_llm_response(raw_output: str) -> ValidationResult:
    parsed = parse_llm_output(raw_output)

    if not parsed.is_parsed:
        return _build_parse_error(parsed)

    return _check_keywords(parsed)


def _build_parse_error(parsed: ParsedResponse) -> ValidationResult:
    return ValidationResult(
        is_valid=False,
        error_type=PARSE_ERROR,
        msg=parsed.parse_error
    )


def _check_keywords(parsed: ParsedResponse) -> ValidationResult:
    combined = f"{parsed.type} {parsed.msg}"

    if not has_bad_keywords(combined):
        return ValidationResult(is_valid=True, kind=parsed.type, msg=parsed.msg)

    triggered = get_triggered_keyword(combined)
    return ValidationResult(
        is_valid=False,
        error_type=KEYWORD_ERROR,
        msg=f"Bad keyword detected: '{triggered}'"
    )
