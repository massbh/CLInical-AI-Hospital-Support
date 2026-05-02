from dataclasses import dataclass

VALIDATION_ERROR = "validation-error"
KEYWORD_ERROR = "keyword-error"
PARSE_ERROR = "parse_error"


@dataclass
class ValidationResult:
    is_valid: bool
    error_type: str | None = None
    msg: str | None = None
    kind: str | None = None  # "Note" or "Suggestion" when is_valid is True

    def to_error_dict(self) -> dict:
        return {
            "type": self.error_type,
            "msg": self.msg,
        }
