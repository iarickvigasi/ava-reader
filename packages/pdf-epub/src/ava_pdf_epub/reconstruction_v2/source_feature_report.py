"""Finite coverage is not global visual fidelity; optional unknowns stay distinct from structure."""

from typing import Any

from ..contracts.book import CanonicalBookV2
from ..contracts.common import text_digest
from .assembly_state import AssemblyState
from .source_feature_contract import FEATURE_POLICY
from .source_feature_coverage_contract import SourceFeatureCoverage
from .source_feature_response import STYLE_FEATURES


def source_feature_coverage(state: AssemblyState, book: CanonicalBookV2) -> dict[str, Any] | None:
    if state.source_feature_policy is None:
        return None
    if state.source_feature_policy != FEATURE_POLICY:
        raise ValueError("Unsupported source feature policy")
    coverage = SourceFeatureCoverage.model_validate(
        dict(
            policy_id=FEATURE_POLICY,
            requested_features=state.requested_source_features,
            inspected_features=sum(e["task_id"] is not None for e in state.source_feature_evidence),
            uninspected_features=sum(e["task_id"] is None for e in state.source_feature_evidence),
            unrequested_optional_candidates=state.unrequested_optional_features,
            evidence=state.source_feature_evidence,
        )
    )
    identities = [(e.node_id, e.feature) for e in coverage.evidence]
    if len(set(identities)) != len(identities) or len(identities) != coverage.requested_features:
        raise ValueError("Finite source feature coverage is incomplete or duplicated")
    if any(
        e.feature == "paragraph_role" and e.disposition != "observed" for e in coverage.evidence
    ):
        raise ValueError("Essential source role cannot remain unqualified")
    blocks, styles = {b.id: b for b in book.blocks}, {s.id: s for s in book.styles}
    for evidence in coverage.evidence:
        block = blocks.get(evidence.canonical_block_id or "")
        if block is None or not hasattr(block, "content") or evidence.canonical_start is None:
            raise ValueError("Source feature lacks final canonical text binding")
        start, end = evidence.canonical_start, evidence.canonical_start + evidence.text_length
        page = next((p for p in book.pages if p.number == evidence.page), None)
        if (
            page is None
            or not evidence.box.within(page.width_pt, page.height_pt)
            or not any(
                item.method == "ocr" and item.page == evidence.page and item.box == evidence.box
                for item in block.evidence
            )
        ):
            raise ValueError("Source feature lacks exact canonical OCR page/box evidence")
        if (
            end > len(block.content.text)
            or text_digest(block.content.text[start:end]) != evidence.text_sha256
            or evidence.source_sha256 != book.source.sha256
        ):
            raise ValueError("Source feature canonical/source identity differs")
        if evidence.disposition == "observed":
            if evidence.feature == "paragraph_role":
                if block.kind != evidence.value:
                    raise ValueError("Observed role differs from canonical projection")
            else:
                style = styles.get(block.style_id or "")
                if (
                    style is None
                    or getattr(style, STYLE_FEATURES[evidence.feature]) != evidence.value
                ):
                    raise ValueError("Observed feature differs from canonical style")
    return coverage.model_dump(mode="json")
