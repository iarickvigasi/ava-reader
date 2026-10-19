"""Authored pixels and explicit test decisions; not provider or supplied-book evidence."""

from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_role_contract import SourceRoleResponse

from .source_feature_fixtures import case


def role_case(scratch: Path):
    source, page, owners, _, _ = case(scratch)
    owner = next(s for s in owners if s.id == "quoted").model_copy(update={"kind": "quote"})
    state = AssemblyState(source_continuation_policy=POLICY)
    tasks = source_feature_tasks(
        source, scratch, [page], [owner], state, 0, include_unreferenced_roles=True
    )
    assert len(tasks) == 1
    return source, page, owner, state, tasks[0]


def role_response(task, role="quote"):
    return SourceRoleResponse.model_validate(
        dict(
            schema_version="ava-book-refinement-response-6",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            image_sha256=task.image.sha256,
            unresolved=[],
            role_decisions=[
                dict(
                    node_id=n.id,
                    text_sha256=n.text_sha256,
                    role=role,
                    reason=None if role else "source_context_insufficient",
                    evidence_ids=[
                        c.id for c in task.crops if c.part == "page" or c.node_id == n.id
                    ],
                )
                for n in task.nodes
            ],
        )
    )
