"""Scalar inventory from qualified page work, with bounded allowlisted source locations."""

from collections import Counter
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .reconstruction_v2.prepared import PreparedPage

SOURCE_FLAGS = {
    "clipped_glyph",
    "unreliable_glyph_mapping",
    "glyph_without_visible_ink",
    "complex_graphics_state",
    "nonstandard_text_rendering",
    "conditional_visibility",
    "optional_content",
    "language_uncertain",
    "visible_annotation",
}
ANNOTATION_KINDS = {"link", "empty", "personal", "visible"}
LAYOUTS = {"single_column", "two_column", "review_required", "unknown"}
LANGUAGE_CHARACTERS = 65536


class Inventory:
    def __init__(self) -> None:
        self.source_bytes_verified = False
        self.observed_profile_id: str | None = None
        self.source_page_count: int | None = None
        self.seen: set[int] = set()
        self.languages: dict[int, str] = {}
        self.layouts: dict[int, str] = {}
        self.routes: dict[int, str] = {}
        self.annotations: dict[int, Counter[str]] = {}
        self.flags: dict[str, set[int]] = {}

    def source(self, count: int, number: int, profile: str) -> None:
        if not 1 <= number <= count <= 500:
            raise ValueError("Invalid observed page inventory")
        if self.source_page_count not in {None, count} or self.observed_profile_id not in {
            None,
            profile,
        }:
            raise ValueError("Observed source inventory changed")
        self.source_page_count, self.observed_profile_id = count, profile
        self.seen.add(number)

    def page(self, page: "PreparedPage") -> None:
        from .reconstruction_v2.book_language import observed_language

        number = page.observation.number
        lines = page.observation.lines
        length = sum(len(line.text) + 1 for line in lines)
        # Do not amplify a pathological source's memory use to obtain an optional heuristic.
        self.languages[number] = (
            observed_language(" ".join(line.text for line in lines))
            if length <= LANGUAGE_CHARACTERS
            else None
        ) or "unknown"
        self.routes[number] = (
            "hybrid"
            if page.native_segments and page.tasks
            else "native"
            if page.native_segments
            else "recognition"
            if page.tasks
            else "blank"
        )
        for code in SOURCE_FLAGS.intersection(page.observation.risks):
            self.flags.setdefault(code, set()).add(number)

    def annotation(self, number: int, kinds: list[str]) -> None:
        if any(kind not in ANNOTATION_KINDS for kind in kinds) or len(kinds) > 1000:
            raise ValueError("Invalid annotation inventory")
        self.annotations[number] = Counter(kinds)

    def layout(self, number: int, layout: str) -> None:
        if layout not in LAYOUTS or not 1 <= number <= 500:
            raise ValueError("Invalid layout inventory")
        self.layouts[number] = layout

    def packet(self) -> dict[str, object]:
        completed = len(self.languages)
        coverage = (
            "unknown"
            if self.source_page_count is None
            else (
                "full"
                if self.source_bytes_verified and completed == self.source_page_count
                else "partial"
            )
        )
        languages = Counter(self.languages.values())
        layouts = Counter(self.layouts.get(number, "unknown") for number in self.languages)
        routes = Counter(self.routes.get(number, "unknown") for number in self.languages)
        annotations = sum(self.annotations.values(), Counter())
        locations = [
            dict(code=code, page=number)
            for code in sorted(self.flags)
            for number in sorted(self.flags[code])
        ]
        return dict(
            coverage=coverage,
            source_bytes_verified=self.source_bytes_verified,
            language_method="bounded_native_page_script_and_hint_heuristic",
            language_character_limit=LANGUAGE_CHARACTERS,
            layout_method="qualified_native_reading_order_or_review",
            annotation_scope="original_top_level_objects_classified",
            observed_profile_id=self.observed_profile_id,
            source_page_count=self.source_page_count,
            observed_pages=len(self.seen),
            prepared_pages=completed,
            language_pages={key: languages[key] for key in ("en", "uk", "unknown")},
            layout_pages={
                key: layouts[key]
                for key in ("single_column", "two_column", "review_required", "unknown")
            },
            route_pages={
                key: routes[key] for key in ("native", "recognition", "hybrid", "blank", "unknown")
            },
            annotation_counts={
                key: annotations[key] for key in ("link", "empty", "personal", "visible")
            },
            flags=[dict(code=code, pages=len(self.flags[code])) for code in sorted(self.flags)],
            locations=locations[:8],
            locations_complete=len(locations) <= 8,
        )
