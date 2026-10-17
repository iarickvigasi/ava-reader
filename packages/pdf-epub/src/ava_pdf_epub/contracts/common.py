"""Strict wire primitives shared by the versioned contract family."""

import hashlib
import json
import re
from typing import Annotated, ClassVar, Literal, get_args, get_origin

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
_INVALID_XML_SCALAR = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]")


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, frozen=True)
    _literal_fields: ClassVar[tuple[tuple[str, tuple[object, ...]], ...]] = ()

    @classmethod
    def __pydantic_on_complete__(cls) -> None:
        # Locked contract classes are static; prepare after forward fields are resolved.
        super().__pydantic_on_complete__()
        cls._literal_fields = tuple(
            (name, get_args(field.annotation))
            for name, field in cls.model_fields.items()
            if get_origin(field.annotation) is Literal
        )

    @model_validator(mode="before")
    @classmethod
    def exact_literals(cls, value: object) -> object:
        if isinstance(value, dict):
            for name, expected_values in cls._literal_fields:
                if name in value:
                    actual = value[name]
                    if not any(
                        type(actual) is type(expected) and actual == expected
                        for expected in expected_values
                    ):
                        raise ValueError("Literal value has an incompatible type")
        return value

    @field_validator("*")
    @classmethod
    def valid_xml_scalars(cls, value: object) -> object:
        if isinstance(value, str) and _INVALID_XML_SCALAR.search(value):
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
