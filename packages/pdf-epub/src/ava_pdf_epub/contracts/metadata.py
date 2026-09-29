"""Preserve evidence and scope; a print ISBN is not the generated EPUB identifier."""

from typing import Literal, Self

from pydantic import Field, model_validator

from .common import Id, Record
from .source import Evidence


class MetadataClaim(Record):
    id: Id
    field: Literal[
        "title",
        "subtitle",
        "contributor",
        "publisher",
        "date",
        "language",
        "identifier",
        "rights",
        "edition",
        "description",
        "subject",
    ]
    value: str | None = Field(default=None, min_length=1, max_length=4000)
    status: Literal["accepted", "candidate", "conflict", "unknown"]
    scope: Literal["work", "source_edition", "conversion"]
    origin: Literal["source", "user", "generated"]
    contributor_role: Literal["author", "editor", "translator", "illustrator", "other"] | None = (
        None
    )
    identifier_scheme: Literal["isbn", "uuid", "uri", "other"] | None = None
    evidence: list[Evidence] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def claim_scope(self) -> Self:
        if (self.status == "unknown") != (self.value is None):
            raise ValueError("Unknown claims have no value; other claims require a value")
        if (self.field == "contributor") != (self.contributor_role is not None):
            raise ValueError("Contributor claims require a typed role only")
        if (self.field == "identifier") != (self.identifier_scheme is not None):
            raise ValueError("Identifier claims require a scheme only")
        if self.origin == "source" and not self.evidence:
            raise ValueError("Source metadata requires evidence")
        if self.origin == "generated" and (
            self.scope != "conversion" or self.field != "identifier"
        ):
            raise ValueError("Generated metadata is limited to conversion identity")
        if self.scope == "conversion" and self.identifier_scheme == "isbn":
            raise ValueError("Print ISBN cannot identify a generated edition")
        return self
