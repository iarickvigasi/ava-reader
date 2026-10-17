"""Authored full physical pairs, structural cuts and honest compact-response authority."""

from ava_pdf_epub.contracts.layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from ava_pdf_epub.contracts.layout_hyphen_classification_v3 import LayoutHyphenClassificationReceipt
from ava_pdf_epub.contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2, candidate_digest_v2
from ava_pdf_epub.contracts.layout_source_cuts_v3 import exact_source_cut_text
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization_v3 import (
    normalize_layout_hyphens_v3,
)

from .layout_hyphen_fixtures import authored_hyphens
from .layout_v3_cut_fixture import authored_cuts

PDF = "a" * 64


def fixture_v3(
    left="possess-",
    right="ing",
    *,
    role="paragraph",
    prefixes=(),
    page=False,
    decision="layout",
    prefix="",
):
    pair = left + "\n" + right
    old, _ = authored_hyphens(pair, [(0, "layout")], pages={0: 1, 1: 2} if page else None)
    witnesses = [old[0].left, old[0].right]
    cuts = authored_cuts(witnesses, left, right, prefixes, role)
    end = witnesses[1].source_start + (
        len(prefixes[-1][1]) if prefixes and prefixes[-1][0] == 1 else 0
    )
    candidate = LayoutHyphenCandidateV2.model_validate(
        {
            **old[0].model_dump(),
            "schema_version": "ava-layout-hyphen-candidate-2",
            "id": "w00001",
            "role": role,
            "source_end": end,
        }
    )
    classification = LayoutHyphenClassificationReceipt(
        authority="word_wrap",
        task_id="wrap-task",
        task_sha256="b" * 64,
        response_sha256="c" * 64,
        catalogue_sha256="d" * 64,
        candidate_id=candidate.id,
        source_candidate_sha256=candidate_digest_v2(candidate),
        decision=decision,
    )
    authority = LayoutHyphenAuthorityV3(
        candidate=candidate,
        pair_source=pair,
        pair_cuts=cuts,
        classification=classification,
        original_source_offset=len(prefix),
        source_offset=len(prefix),
        retained_left_line_start=sum(
            c.source_end - c.source_start for c in cuts if c.receipt.line_id == witnesses[0].line_id
        ),
        retained_right_line_start=sum(
            c.source_end - c.source_start for c in cuts if c.receipt.line_id == witnesses[1].line_id
        ),
    )
    original = prefix + pair
    owner_cuts = [
        c.model_copy(
            update={
                "source_start": c.source_start + len(prefix),
                "source_end": c.source_end + len(prefix),
            }
        )
        for c in cuts
    ]
    body = exact_source_cut_text(original, owner_cuts, role=role)
    result = normalize_layout_hyphens_v3(
        body,
        PDF,
        role,
        [authority],
        text=body.replace("\r\n", " ").replace("\n", " "),
        original_source_text=original if cuts else None,
        source_cuts=owner_cuts,
    )
    return result
