"""Snapshot only exact original OCR components needed by a finite compound-title feature."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from ..contracts.common import text_digest
from ..contracts.source import Evidence
from .geometry import union

if TYPE_CHECKING:
    from .assembly_state import AssemblyState


@dataclass(frozen=True)
class CompoundFeatureSource:
    evidence: tuple[Evidence, ...]
    ranges: tuple[tuple[int, int, str], ...]
    text_sha256: str
    text_length: int
    canonical_block_id: str
    canonical_start: int


def capture_compound_feature_source(evidence: dict[str, Any], state: "AssemblyState") -> None:
    ident = evidence["node_id"]
    pieces = state.compound_heading_sources.get(ident)
    if pieces is None:
        return
    originals = tuple(Evidence.model_validate(e) for e in state.evidence.get(ident, []))
    if len(pieces) < 2 or len(originals) != len(pieces):
        raise ValueError("Compound feature lacks complete original component evidence")
    for piece, original in zip(pieces, originals, strict=True):
        if (
            piece.method != "ocr"
            or piece.page != evidence["page"]
            or original.method != "ocr"
            or original.page != piece.page
            or original.box != piece.box
            or piece.box.coordinate_space != "page_points_top_left"
            or not piece.text
        ):
            raise ValueError("Compound feature original OCR component differs")
    text = "\n".join(piece.text for piece in pieces)
    if (
        union([e.box for e in originals]).model_dump(mode="json") != evidence["box"]
        or text_digest(text) != evidence["text_sha256"]
        or len(text) != evidence["text_length"]
    ):
        raise ValueError("Compound feature envelope or exact component text differs")
    ranges, cursor = [], 0
    for piece in pieces:
        end = cursor + len(piece.text)
        ranges.append((cursor, end, text_digest(piece.text)))
        cursor = end + 1
    binding = CompoundFeatureSource(
        originals,
        tuple(ranges),
        text_digest(text),
        len(text),
        evidence["canonical_block_id"],
        evidence["canonical_start"],
    )
    previous = state.compound_feature_sources.setdefault(ident, binding)
    if previous != binding:
        raise ValueError("Compound feature appearances disagree on original source")
