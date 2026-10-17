"""Apply only witnessed presentation copies; retain original task/response audit identity."""

from dataclasses import dataclass, field
from typing import Any

from ..contracts.common import document_digest, text_digest
from ..contracts.styles import Style
from .continuation_presentation import uniform_candidate
from .continuation_presentation_contract import (
    POLICY,
    PresentationRefinementResponse,
    PresentationRefinementTask,
)
from .continuation_presentation_response import presentation_projection
from .legacy_refinement_contract import RefinementEdge, RefinementNode
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .refinement_contract import AnyRefinementResponse, AnyRefinementTask
from .segments import Segment


@dataclass(frozen=True)
class PresentationSnapshot:
    styles: dict[str, Style]
    pairs: list[tuple[str, str]]


@dataclass
class ContinuationApplication:
    tasks: list[AnyRefinementTask | FrontmatterTitleTask]
    responses: list[AnyRefinementResponse | FrontmatterTitleResponse]
    styles: dict[str, Style] = field(default_factory=dict)
    evidence: dict[str, dict[str, Any]] = field(default_factory=dict)
    originals: dict[str, PresentationRefinementTask] = field(default_factory=dict)
    pairs: list[tuple[str, str]] = field(default_factory=list)


def prepare_continuation_application(
    segments: list[Segment],
    tasks: list[AnyRefinementTask | FrontmatterTitleTask],
    responses: list[AnyRefinementResponse | FrontmatterTitleResponse],
    policy: str | None,
) -> ContinuationApplication:
    result = ContinuationApplication([], [])
    receipts = {response.task_id: response for response in responses}
    owners = {segment.id: segment for segment in segments}
    for task in tasks:
        response = receipts[task.task_id]
        current = isinstance(task, PresentationRefinementTask)
        if current != isinstance(response, PresentationRefinementResponse):
            raise ValueError("Continuation task and response authority differ")
        if not current:
            result.tasks.append(task)
            result.responses.append(response)
            continue
        if policy != POLICY or not isinstance(response, PresentationRefinementResponse):
            raise ValueError("Continuation presentation requires captured Input10 policy")
        assert isinstance(task, PresentationRefinementTask)
        view = presentation_projection(task, response)
        nodes = {node.id: node for node in task.nodes}
        for ident, style in view.styles.items():
            segment = owners[ident]
            if (
                ident in result.styles
                or segment.kind != "paragraph"
                or segment.structure_candidate
                or segment.preserve_line_breaks
                or segment.style is None
            ):
                raise ValueError("Continuation presentation overlaps or is not qualified prose")
            observed = nodes[ident].observed_style
            if (
                segment.method != ("native" if ident in task.native_endpoints else "ocr")
                or text_digest(segment.text) != nodes[ident].text_sha256
                or observed is None
                or document_digest(segment.style) != document_digest(observed)
            ):
                raise ValueError("Continuation presentation source owner differs")
            result.styles[ident] = style
        selected = {
            choice.candidate_id
            for choice in response.presentations
            if choice.candidate_id is not None
        }
        result.pairs.extend(
            (candidate.previous_id, candidate.next_id)
            for candidate in task.join_candidates
            if candidate.id in selected
        )
        result.evidence[view.task.task_id] = dict(
            task_id=task.task_id,
            task_sha256=document_digest(task),
            response_sha256=document_digest(response),
            observation_sha256=task.observation_sha256,
            node_ids=[
                node.id
                for node in task.nodes
                if node.id in set(task.decision_ids) | view.styles.keys()
            ],
        )
        result.originals[view.task.task_id] = task
        result.tasks.append(view.task)
        result.responses.append(view.response)
    return result


def finalize_continuation_presentation(
    segments: list[Segment],
    plan: ContinuationApplication | PresentationSnapshot,
    source_feature_evidence: list[dict[str, Any]] | None = None,
) -> list[Segment]:
    if not plan.styles:
        return segments
    owners = {segment.id: segment for segment in segments}
    for ident, expected in plan.styles.items():
        segment = owners[ident]
        if segment.kind != "paragraph" or segment.style is None:
            raise ValueError("Source feature correction contradicts paragraph presentation")
        for name, value in expected.model_dump(exclude={"id"}).items():
            if value is not None and getattr(segment.style, name) != value:
                raise ValueError("Source feature correction contradicts witnessed typography")
    for previous_id, next_id in plan.pairs:
        previous, following = owners[previous_id], owners[next_id]

        def node(segment: Segment) -> RefinementNode:
            return RefinementNode(
                id=segment.id,
                page=segment.page,
                kind="paragraph",
                text_sha256=text_digest(segment.text),
                text_excerpt=segment.text[:500],
                observed_level=None,
                observed_chapter=False,
                observed_role=None,
                observed_style=segment.style,
                ranked_source=True,
                body_reference_id=None,
            )

        candidate = uniform_candidate(
            RefinementEdge(id="selected-edge", previous_id=previous_id, next_id=next_id),
            node(previous),
            node(following),
            previous_id if previous.method == "native" else next_id,
        )
        if candidate is None:
            raise ValueError("Final continuation presentation has conflicting source evidence")
        # The positive uniform comparison may fill only an unknown counterpart;
        # the checks above prevent overriding any already-known candidate value.
        owners[previous_id] = previous.model_copy(update={"style": candidate.previous_style})
        owners[next_id] = following.model_copy(update={"style": candidate.next_style})
    fields = {
        "family": "family",
        "weight": "bold",
        "italic": "italic",
        "first_line_indent": "indent_em",
        "block_inset": "block_indent_em",
        "relative_size": "relative_size",
    }
    # A tail observation remains bound to the final head-owned paragraph. Never
    # publish a report claiming an observed value that the joined block cannot carry.
    heads = {right: left for left, right in plan.pairs}
    for evidence in source_feature_evidence or []:
        ident = evidence["node_id"]
        if ident not in plan.styles or evidence["disposition"] != "observed":
            continue
        head = owners[heads.get(ident, ident)]
        feature = evidence["feature"]
        value = head.kind if feature == "paragraph_role" else getattr(head.style, fields[feature])
        if value != evidence["value"]:
            raise ValueError("Observed source feature contradicts final joined presentation")
    return [owners[segment.id] for segment in segments]
