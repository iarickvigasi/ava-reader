"""Strict wire primitives shared by the versioned contract family."""

import hashlib
import json
from typing import Annotated, Literal, get_args, get_origin

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Id = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]{0,119}$", max_length=120)]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$", min_length=64, max_length=64)]
RelativePath = Annotated[
    str,
    Field(
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*$",
        min_length=1,
        max_length=240,
    ),
]
MAX_WIRE_BYTES = 128 * 1024 * 1024


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, frozen=True)

    @model_validator(mode="before")
    @classmethod
    def exact_literals(cls, value: object) -> object:
        if isinstance(value, dict):
            for name, field in cls.model_fields.items():
                if name in value and get_origin(field.annotation) is Literal:
                    actual = value[name]
                    if not any(
                        type(actual) is type(expected) and actual == expected
                        for expected in get_args(field.annotation)
                    ):
                        raise ValueError("Literal value has an incompatible type")
        return value

    @field_validator("*")
    @classmethod
    def valid_xml_scalars(cls, value: object) -> object:
        if isinstance(value, str) and any(
            not (
                c in "\t\n\r"
                or 0x20 <= ord(c) <= 0xD7FF
                or 0xE000 <= ord(c) <= 0xFFFD
                or 0x10000 <= ord(c) <= 0x10FFFF
            )
            for c in value
        ):
            raise ValueError("Invalid text scalar")
        return value


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def document_digest(record: Record) -> str:
    """ava-json-v1: validated model dump, defaults included, sorted compact UTF-8 JSON.

    This is not RFC8785. Consumers delegate semantic hashing to this pinned Python boundary.
    Artifact hashes separately cover their exact stored bytes.
    """
    wire = json.dumps(
        record.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return text_digest(wire)


def unique(values: list[str], label: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError("Duplicate " + label)
