"""Qualify exact visible native glyphs; unsafe extraction keeps the existing OCR route."""

from collections.abc import Sequence

from ..contracts.common import document_digest, text_digest
from ..contracts.layout_hyphen import LayoutHyphenCandidate, candidate_digest
from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .classify_lines import classify_lines
from .native_review import NativeReviewRequired
from .native_structure_contract import NativeStructureTask
from .native_structure_fields import (
    NativeStructureArtifact,
    NativeStructureBoundary,
    NativeStructureLine,
    NativeStructureRegion,
    NativeStructureSpan,
)
from .native_structure_identity import native_structure_identifier
from .native_structure_policy import AnyNativeStructurePolicy, validate_structure_policy
from .native_structure_v2_contract import NativeStructureTask2
from .native_structure_versions import AnyNativeStructureTask
from .observations import PageObservation
from .recognition_contract import RecognitionImage
from .segments import Segment


def qualified_native_lines(
    page: PageObservation, profile_id: ProfileId = LEGACY_PROFILE
) -> list[NativeStructureLine] | None:
    allowed = {"language_uncertain", "visible_annotation"}
    if (
        page.rotation != 0
        or not page.lines
        or set(page.risks) - allowed
        or any(r.kind != "inline_style" for r in page.required_regions)
    ):
        return None
    for line in page.lines:
        cursor = 0
        if not line.glyphs:
            return None
        for glyph in line.glyphs:
            at = line.text.find(glyph.text, cursor)
            box = glyph.box
            if (
                not glyph.visible
                or glyph.source_artifact
                or at < cursor
                or line.text[cursor:at].strip()
                or box.coordinate_space != "page_points_top_left"
                or not (
                    line.box.x0 <= box.x0 < box.x1 <= line.box.x1
                    and line.box.y0 <= box.y0 < box.y1 <= line.box.y1
                )
            ):
                return None
            cursor = at + len(glyph.text)
        if line.text[cursor:].strip():
            return None
    try:
        segments = classify_lines(page, set(), set(), profile_id)
    except NativeReviewRequired:
        return None
    return [
        NativeStructureLine(
            id=s.id,
            text=s.text,
            text_sha256=text_digest(s.text),
            box=s.box,
            style=s.style,
            spans=[
                NativeStructureSpan(id=f"{s.id}-span{i}", **span.model_dump())
                for i, span in enumerate(s.spans)
            ],
        )
        for s in segments
        if s.style is not None
    ]


def prepare_native_structure(
    page: PageObservation,
    source_sha256: str,
    image: RecognitionImage,
    regions: Sequence[NativeStructureRegion],
    *,
    profile_id: ProfileId = LEGACY_PROFILE,
    preserved_segments: Sequence[Segment] = (),
    furniture: set[str] | None = None,
    candidates: Sequence[LayoutHyphenCandidate] = (),
    structure_policy: AnyNativeStructurePolicy = "ava-native-structure-1",
) -> AnyNativeStructureTask | None:
    selected = validate_structure_policy(structure_policy)
    version = 2 if selected == "ava-native-structure-2" else 1
    lines = qualified_native_lines(page, profile_id)
    if lines is None:
        return None
    from .native_structure_callouts import eligible_native_callouts
    from .native_structure_source_validation import (
        graphics_are_preserved,
        validate_source_ownership,
    )

    if not graphics_are_preserved(page, preserved_segments):
        return None

    artifacts = [
        NativeStructureArtifact.model_validate(
            dict(id=s.id, kind=s.kind, segment_sha256=document_digest(s))
        )
        for s in preserved_segments
    ]
    boundaries = [
        NativeStructureBoundary(
            candidate_id=c.id,
            candidate_sha256=candidate_digest(c),
            left_line_id=c.left.line_id,
            right_line_id=c.right.line_id,
            role=c.role,
            boundary=c.boundary,
        )
        for c in candidates
    ]
    values = dict(
        schema_version=f"ava-native-structure-task-{version}",
        task_id="pending",
        purpose="pdf_native_structure",
        source_sha256=source_sha256,
        observation_sha256=document_digest(page),
        profile_id=profile_id,
        page_number=page.number,
        page_width_pt=page.width_pt,
        page_height_pt=page.height_pt,
        image=image.model_dump(),
        lines=[line.model_dump() for line in lines],
        regions=[r.model_dump() for r in regions],
        artifacts=[a.model_dump() for a in artifacts],
        boundaries=[b.model_dump() for b in boundaries],
        eligible_callouts=[c.model_dump() for c in eligible_native_callouts(page, lines, regions)],
        prompt_version=f"ava-native-structure-{version}",
        response_schema_version=f"ava-native-structure-response-{version}",
    )
    values["task_id"] = native_structure_identifier(values)
    task: AnyNativeStructureTask = (
        NativeStructureTask2.model_validate(values)
        if version == 2
        else NativeStructureTask.model_validate(values)
    )
    validate_source_ownership(task, page, preserved_segments, furniture=furniture or set())
    owners = {ident: r.source.id for r in task.regions for ident in r.line_ids}
    source_lines = {line.id: line for line in task.lines}
    for candidate in candidates:
        if candidate.source_sha256 != source_sha256:
            raise ValueError("Native structure boundary source digest differs")
        for witness in (candidate.left, candidate.right):
            line = source_lines.get(witness.line_id)
            if (
                line is None
                or witness.page != page.number
                or witness.box != line.box
                or witness.region_id != owners[line.id]
            ):
                raise ValueError("Native structure boundary source witness differs")
    return task
