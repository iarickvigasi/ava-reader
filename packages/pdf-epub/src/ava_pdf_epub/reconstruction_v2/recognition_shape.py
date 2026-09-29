"""JSON Schema branches mirror conditional observation requirements."""

from typing import Any

from .recognition_requirements import KIND_REQUIRED

KINDS = [
    "paragraph",
    "heading",
    "quote",
    "aside",
    "caption",
    "credit",
    "verse",
    "code",
    "list_item",
    "note",
    "figure",
    "table",
    "separator",
    "furniture",
    "unsupported",
]


def segment_shape(schema: dict[str, Any]) -> None:
    def branch(kinds: list[str], **properties: object) -> dict[str, object]:
        return {
            "type": "object",
            "properties": {"kind": {"enum": kinds}, **properties},
            "required": sorted(
                set(
                    [field for kind in kinds for field in KIND_REQUIRED.get(kind, [])]
                    + [field for field in ["chapter_role", "list_start"] if field in properties]
                )
            ),
        }

    empty = {"type": "array", "maxItems": 0}
    base = dict(schema)
    schema.clear()
    schema["allOf"] = [
        base,
        {
            "anyOf": [
                branch(
                    ["heading"],
                    heading_level={"type": "integer", "minimum": 1, "maximum": 6},
                    cells=empty,
                ),
                branch(
                    ["note"],
                    note_label={"type": "string", "minLength": 1},
                    note_role={"enum": ["footnote", "endnote"]},
                    cells=empty,
                ),
                branch(
                    ["list_item"],
                    list_ordered={"type": "boolean"},
                    list_depth={"type": "integer", "minimum": 1, "maximum": 3},
                    cells=empty,
                ),
                branch(
                    ["table"],
                    cells={
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "array", "minItems": 1, "maxItems": 8},
                    },
                ),
                *[
                    branch([kind], cells=empty)
                    for kind in KINDS
                    if kind not in {"heading", "note", "list_item", "table"}
                ],
            ]
        },
        {
            "anyOf": [
                {"type": "object", "properties": {"chapter_start": {"const": False}}},
                branch(
                    ["heading"],
                    chapter_start={"const": True},
                    heading_level={"const": 1},
                    chapter_role={"enum": ["frontmatter", "bodymatter", "backmatter"]},
                ),
            ]
        },
        {
            "anyOf": [
                {"type": "object", "properties": {"list_ordered": {"enum": [None, False]}}},
                branch(
                    ["list_item"],
                    list_ordered={"const": True},
                    list_start={"type": "integer", "minimum": 0, "maximum": 1000000},
                ),
            ]
        },
    ]
