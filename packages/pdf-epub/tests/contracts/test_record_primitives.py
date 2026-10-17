import unittest
from typing import TYPE_CHECKING, Literal

from pydantic import ValidationError

from ava_pdf_epub.contracts.common import Record

if TYPE_CHECKING:
    DeferredLiteral = Literal[False]


class TextRecord(Record):
    text: str


class LiteralRecord(Record):
    boolean: Literal[False]
    integer: Literal[1]
    string: Literal["fixed"]


class NestedRecord(Record):
    child: LiteralRecord
    text: str


class BaseKind(Record):
    kind: Literal["base"]


class ChildKind(BaseKind):
    kind: Literal["child"]
    enabled: Literal[True]


class RecordPrimitiveTests(unittest.TestCase):
    def test_xml_allowed_boundaries_preserve_exact_text(self):
        points = [
            9,
            10,
            13,
            0x20,
            0x7F,
            0x85,
            0xD7FF,
            0xE000,
            0xFFFD,
            0x10000,
            0x1FFFE,
            0x1FFFF,
            0x10FFFF,
        ]
        text = "Before" + "".join(chr(point) for point in points) + "After"
        self.assertEqual(TextRecord(text=text).text, text)
        self.assertEqual(TextRecord(text="").text, "")

    def test_xml_forbidden_controls_surrogates_and_bmp_noncharacters(self):
        points = [*range(9), 11, 12, *range(14, 32), *range(0xD800, 0xE000), 0xFFFE, 0xFFFF]
        for point in points:
            with self.subTest(point=hex(point)), self.assertRaises(ValidationError):
                TextRecord(text="Before" + chr(point) + "After")

    def test_surrogate_pairs_are_not_repaired_into_non_bmp_characters(self):
        with self.assertRaises(ValidationError):
            TextRecord(text="\ud800\udc00")
        self.assertEqual(TextRecord(text="\U00010000").text, "\U00010000")

    def test_exact_boolean_integer_and_string_literals(self):
        valid = {"boolean": False, "integer": 1, "string": "fixed"}
        self.assertEqual(LiteralRecord.model_validate(valid).model_dump(), valid)
        changes = [
            ("boolean", 0),
            ("boolean", 0.0),
            ("boolean", "false"),
            ("integer", True),
            ("integer", 1.0),
            ("integer", "1"),
            ("string", 1),
            ("string", b"fixed"),
        ]
        for name, value in changes:
            with self.subTest(name=name, value=value), self.assertRaises(ValidationError):
                LiteralRecord.model_validate({**valid, name: value})

    def test_nested_records_keep_literal_and_xml_refusals(self):
        child = {"boolean": False, "integer": 1, "string": "fixed"}
        value = NestedRecord.model_validate({"child": child, "text": "🧭"})
        self.assertEqual(value.model_dump(), {"child": child, "text": "🧭"})
        for payload in [
            {"child": {**child, "boolean": 0}, "text": "ok"},
            {"child": child, "text": "\x00"},
        ]:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                NestedRecord.model_validate(payload)

    def test_subclass_literal_overrides_do_not_share_base_descriptors(self):
        self.assertEqual(BaseKind(kind="base").kind, "base")
        self.assertEqual(ChildKind(kind="child", enabled=True).kind, "child")
        for payload in [{"kind": "base", "enabled": True}, {"kind": "child", "enabled": 1}]:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                ChildKind.model_validate(payload)
        with self.assertRaises(ValidationError):
            BaseKind(kind="child")

    def test_literal_descriptors_wait_for_forward_annotation_resolution(self):
        class DeferredRecord(Record):
            value: "DeferredLiteral"

        DeferredRecord.model_rebuild(_types_namespace={"DeferredLiteral": Literal[False]})
        self.assertFalse(DeferredRecord.model_validate({"value": False}).value)
        with self.assertRaises(ValidationError):
            DeferredRecord.model_validate({"value": 0})

    def test_internal_descriptors_are_not_accepted_fields_or_exported_data(self):
        value = LiteralRecord(boolean=False, integer=1, string="fixed")
        self.assertEqual(set(value.model_dump()), {"boolean", "integer", "string"})
        with self.assertRaises(ValidationError):
            LiteralRecord.model_validate({**value.model_dump(), "_literal_fields": []})
