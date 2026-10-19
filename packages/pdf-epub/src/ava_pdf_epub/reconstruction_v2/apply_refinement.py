"""Apply source-bound structure-only decisions to copies, retaining original observations."""

from ..contracts.common import document_digest, text_digest
from .assembly_state import AssemblyState
from .compound_heading_style_update import compound_style_update
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .refinement_contract import (
    AnyRefinementResponse,
    AnyRefinementTask,
    BookRefinementResponse,
    BookRefinementTask,
    PrintedTitleResponse,
    PrintedTitleTask,
)
from .refinement_digest import observation_digest
from .refinement_graph import HeadingParentMissing, validate_refined_graph
from .refinement_joins import refined_boundaries
from .refinement_response import accept_refinement
from .segments import Segment
from .source_feature_task_contract import SourceFeatureTask
from .source_refusal import refuse_heading_parent
from .source_role_contract import SourceRoleResponse, SourceRoleTask


def apply_refinement(
    segments: list[Segment],
    all_tasks: list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask],
    all_responses: list[AnyRefinementResponse | FrontmatterTitleResponse | SourceRoleResponse],
    state: AssemblyState,
) -> list[Segment]:
    if any(t.observation_sha256 != observation_digest(segments) for t in all_tasks):
        raise ValueError("Refinement observation identity differs")
    all_receipts = {r.task_id: r for r in all_responses}
    if len(all_receipts) != len(all_responses) or set(all_receipts) != {
        t.task_id for t in all_tasks
    }:
        raise ValueError("Refinement task coverage differs")
    from .source_role_application import source_role_application

    ordinary_tasks, ordinary_responses, role_tasks, role_receipts = source_role_application(
        segments, all_tasks, all_responses, state
    )
    from .continuation_application import (
        PresentationSnapshot,
        finalize_continuation_presentation,
        prepare_continuation_application,
    )

    presentation = prepare_continuation_application(
        segments, ordinary_tasks, ordinary_responses, state.source_continuation_policy
    )
    tasks, responses = presentation.tasks, presentation.responses
    receipts = {response.task_id: response for response in responses}
    updates, parents, edges = {}, {}, {}
    evidence = []
    feature_tasks: list[SourceFeatureTask] = []
    for task in tasks:
        response = receipts[task.task_id]
        accept_refinement(task, response)
        if isinstance(task, FrontmatterTitleTask):
            from .frontmatter_title_apply import apply_frontmatter_title

            if not isinstance(response, FrontmatterTitleResponse):
                raise ValueError("Complete title response authority differs")
            apply_frontmatter_title(task, response, state)
            continue
        if isinstance(task, PrintedTitleTask):
            if state.printed_title is not None or not isinstance(response, PrintedTitleResponse):
                raise ValueError("Repeated or mismatched printed title authority")
            state.printed_title = (task.node.id, task.node.text_sha256, response.decision.role)
            evidence.append(
                dict(
                    task_sha256=document_digest(task),
                    response_sha256=document_digest(response),
                    observation_sha256=task.observation_sha256,
                    task_id=task.task_id,
                    node_ids=[task.node.id],
                )
            )
            continue
        if isinstance(task, SourceFeatureTask):
            feature_tasks.append(task)
            continue
        if not isinstance(response, BookRefinementResponse):
            raise ValueError("Historical response authority differs")
        for metadata in response.metadata_decisions:
            if metadata.node_id in state.bibliographic_roles:
                raise ValueError("Repeated bibliographic decision")
            text = ""
            if metadata.role is not None:
                assert metadata.start is not None and metadata.end is not None
                node = next(n for n in task.nodes if n.id == metadata.node_id)
                text = node.text_excerpt[metadata.start : metadata.end]
                if state.word_wrap_active:
                    original = next(s.text for s in segments if s.id == metadata.node_id)
                    if text_digest(original) != node.text_sha256:
                        raise ValueError("Bibliographic original owner differs from its task")
                    state.bibliographic_source_ranges[metadata.node_id] = (
                        metadata.start,
                        metadata.end,
                        len(original),
                        node.text_sha256,
                        document_digest(task),
                        document_digest(response),
                    )
            state.bibliographic_roles[metadata.node_id] = (metadata.role, text)
        for decision in response.decisions:
            if decision.node_id in updates:
                raise ValueError("Repeated refinement decision")
            updates[decision.node_id] = decision
            parents[decision.node_id] = decision.parent_id
        edge_map = {e.id: e for e in task.edges}
        for join in response.joins:
            edge = edge_map[join.edge_id]
            edges[(edge.previous_id, edge.next_id)] = join.join
        evidence.append(
            presentation.evidence.get(task.task_id)
            or dict(
                task_sha256=document_digest(task),
                response_sha256=document_digest(response),
                observation_sha256=task.observation_sha256,
                task_id=task.task_id,
                node_ids=[d.node_id for d in response.decisions]
                + [d.node_id for d in response.metadata_decisions],
            )
        )
    if state.frontmatter_title is not None:
        selected_role = state.bibliographic_roles.get(state.frontmatter_title[0])
        if selected_role is not None and selected_role[0] is not None:
            raise ValueError("Selected book title conflicts with a bibliographic role")
    result = []
    for segment in segments:
        if segment.id in presentation.styles:
            segment = segment.model_copy(update={"style": presentation.styles[segment.id]})
        patch = updates.get(segment.id)
        if patch:
            if segment.structure_candidate:
                if patch.role_kind is None:
                    raise ValueError("Native role decision absent")
                if segment.kind == "heading" and patch.role_kind != "heading":
                    raise ValueError("Native heading rank review cannot change the observed role")
                values = segment.model_dump()
                values.update(kind=patch.role_kind, structure_candidate=False)
                if segment.kind == "verse" and patch.role_kind == "paragraph":
                    # Unwrap only layout separators; glyph/span offsets are unchanged.
                    values["text"] = segment.text.replace("\n", " ")
                if patch.role_kind == "heading":
                    values.update(
                        heading_level=patch.heading_level,
                        chapter_start=patch.chapter_start,
                        chapter_role=patch.chapter_role,
                    )
                if patch.role_kind != "list_item":
                    values.update(list_ordered=None, list_start=None, list_depth=None)
                segment = Segment.model_validate(values)
                result.append(segment)
                continue
            if segment.method != "ocr":
                raise ValueError("Refinement cannot override native source observations")
            if patch.style is None:
                raise ValueError("OCR refinement needs observed typography")
            style = segment.style.model_dump() if segment.style else {"id": "observed"}
            style.update(patch.style.model_dump(exclude_none=True))
            values = segment.model_dump()
            values["style"] = style
            if segment.kind == "heading":
                values.update(
                    heading_level=patch.heading_level,
                    chapter_start=patch.chapter_start,
                    chapter_role=patch.chapter_role,
                )
            segment = compound_style_update(Segment.model_validate(values), state)
        result.append(segment)
    try:
        validate_refined_graph(result, parents)
    except HeadingParentMissing as error:
        owners = [
            t
            for t in tasks
            if isinstance(t, BookRefinementTask) and error.segment.id in t.decision_ids
        ]
        if len(owners) == 1:
            refuse_heading_parent(
                presentation.originals.get(owners[0].task_id, owners[0]), error.segment
            )
        raise
    result = refined_boundaries(result, edges)
    state.refined_joins.update(edges)
    state.refinement_evidence.extend(evidence)
    state.structure_findings = [
        f
        for f in state.structure_findings
        if f.block_id not in updates or f.severity == "information"
    ]
    from .source_feature_apply import apply_source_features

    feature_receipts = {
        ident: response
        for ident, response in receipts.items()
        if not isinstance(response, FrontmatterTitleResponse)
    }
    result = apply_source_features(result, feature_tasks, feature_receipts, state)
    from .source_role_apply import apply_source_roles

    result = apply_source_roles(result, role_tasks, role_receipts, state)
    result = finalize_continuation_presentation(result, presentation, state.source_feature_evidence)
    if presentation.styles:
        state.continuation_presentation = PresentationSnapshot(
            presentation.styles, presentation.pairs
        )
    # A refused join already separated the endpoints; only true joins need a role/style recheck.
    return refined_boundaries(result, {key: value for key, value in edges.items() if value})
