"""Immutable conversion profiles: extending language scope never rewrites legacy content."""

from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from .book import CanonicalBookV2

ProfileId = Literal["ava-pdf-prose-en-v2", "ava-pdf-prose-en-uk-v3"]
LEGACY_PROFILE: ProfileId = "ava-pdf-prose-en-v2"
BILINGUAL_PROFILE: ProfileId = "ava-pdf-prose-en-uk-v3"


def checked_profile(value: str) -> ProfileId:
    if value not in (LEGACY_PROFILE, BILINGUAL_PROFILE):
        raise ValueError("Unsupported conversion profile")
    return value


def response_language(value: str, profile: ProfileId) -> Literal["en", "uk"]:
    primary = value.lower().split("-")[0]
    if primary in {"en", "english"}:
        return "en"
    if profile == BILINGUAL_PROFILE and primary in {"uk", "ukrainian"}:
        return "uk"
    raise ValueError("Unsupported recognition language")


def package_language(book: "CanonicalBookV2") -> str:
    languages = [m.value for m in book.metadata if m.status == "accepted" and m.field == "language"]
    allowed = {"en", "uk"} if book.profile_id == BILINGUAL_PROFILE else {"en"}
    if len(set(languages)) > 1 or any(
        not value or value.split("-")[0] not in allowed for value in languages
    ):
        raise ValueError("Unsupported or ambiguous accepted language")
    if not languages:
        if book.profile_id == BILINGUAL_PROFILE:
            raise ValueError("Extended profile requires source-supported language metadata")
        return "en"
    return str(languages[0])
