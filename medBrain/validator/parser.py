import re
from dataclasses import dataclass

ALLOWED_TAGS = ("Note", "Suggestion")
TAG_PATTERN = re.compile(r"<(Note|Suggestion)>(.*?)</\1>", re.DOTALL)
ANY_TAG_PATTERN = re.compile(r"</?(?:Note|Suggestion)>")


@dataclass
class ParsedResponse:
    is_parsed: bool
    type: str | None = None
    msg: str | None = None
    items: list[tuple[str, str]] | None = None
    parse_error: str | None = None

    def to_dict(self) -> dict:
        return {"type": self.type, "msg": self.msg, "items": self.items or []}


def parse_llm_output(raw_output: str) -> ParsedResponse:
    cleaned = raw_output.strip()
    matches = list(TAG_PATTERN.finditer(cleaned))

    if not matches:
        return ParsedResponse(
            is_parsed=False,
            parse_error="No valid <Note> or <Suggestion> tag found"
        )

    return _build_parsed_response(matches, cleaned)


def _build_parsed_response(
    matches: list[re.Match],
    full_text: str,
) -> ParsedResponse:
    items = [(match.group(1), match.group(2).strip()) for match in matches]

    outside_tags = TAG_PATTERN.sub("", full_text).strip()
    if outside_tags:
        return ParsedResponse(
            is_parsed=False,
            parse_error="Response contains text outside Note/Suggestion tags"
        )

    if _has_unbalanced_or_unknown_tag_text(outside_tags):
        return ParsedResponse(
            is_parsed=False,
            parse_error="Response contains malformed Note/Suggestion tags"
        )

    if _tag_count(items, "Note") != 1:
        return ParsedResponse(
            is_parsed=False,
            parse_error="Response must contain exactly one Note tag"
        )

    if _tag_count(items, "Suggestion") > 1:
        return ParsedResponse(
            is_parsed=False,
            parse_error="Response must contain at most one Suggestion tag"
        )

    if any(not content for _, content in items):
        return ParsedResponse(
            is_parsed=False,
            parse_error="Response contains an empty tag"
        )

    items = _ordered_items(items)
    primary_type, primary_msg = items[0]
    return ParsedResponse(
        is_parsed=True,
        type=primary_type,
        msg=primary_msg,
        items=items,
    )


def _tag_count(items: list[tuple[str, str]], tag: str) -> int:
    return sum(1 for item_tag, _ in items if item_tag == tag)


def _ordered_items(items: list[tuple[str, str]]) -> list[tuple[str, str]]:
    note_items = [item for item in items if item[0] == "Note"]
    suggestion_items = [item for item in items if item[0] == "Suggestion"]
    return note_items + suggestion_items


def _has_unbalanced_or_unknown_tag_text(text: str) -> bool:
    return bool(ANY_TAG_PATTERN.search(text))
