"""Content-free evidence of a strict join refusal; never source or style authority."""

import hashlib
from typing import Literal

from pydantic import Field, model_validator

from ..contracts.common import Digest, Record
from ..contracts.styles import Style
from .continuation_boundary import JOIN_STYLE
from .legacy_refinement_contract import BookRefinementTask, RefinementEdge


class JoinTypographyFinding(Record):
    kind: Literal["refinement"] = "refinement"
    code: Literal["JOIN_TYPOGRAPHY_CONFLICT"] = "JOIN_TYPOGRAPHY_CONFLICT"
    stage: Literal["refinement"] = "refinement"
    task_id_sha256: Digest
    edge_id_sha256: Digest
    previous_id_sha256: Digest
    next_id_sha256: Digest
    observation_sha256: Digest
    render_sha256: Digest
    previous_page: int = Field(ge=1, le=500)
    next_page: int = Field(ge=1, le=500)
    conflicting_fields: list[str] = Field(min_length=1, max_length=16)

    @model_validator(mode="after")
    def finite_fields(self) -> "JoinTypographyFinding":
        if self.conflicting_fields != sorted(set(self.conflicting_fields)) or not set(
            self.conflicting_fields
        ) <= JOIN_STYLE | {"style"}:
            raise ValueError("Join conflict fields must be finite and unique")
        return self


class JoinTypographyRefusal(ValueError):
    def __init__(
        self,
        task: BookRefinementTask,
        edge: RefinementEdge,
        previous: Style | None,
        following: Style | None,
    ) -> None:
        super().__init__("Refined join would discard fragment typography")
        nodes = {node.id: node for node in task.nodes}
        a = previous.model_dump(include=JOIN_STYLE) if previous is not None else None
        b = following.model_dump(include=JOIN_STYLE) if following is not None else None
        fields = (
            ["style"]
            if a is None or b is None
            else sorted(k for k in JOIN_STYLE if a.get(k) != b.get(k))
        )

        def digest(value: str) -> str:
            return hashlib.sha256(value.encode()).hexdigest()

        self.source_sha256 = task.source_sha256
        self.finding = JoinTypographyFinding(
            task_id_sha256=digest(task.task_id),
            edge_id_sha256=digest(edge.id),
            previous_id_sha256=digest(edge.previous_id),
            next_id_sha256=digest(edge.next_id),
            observation_sha256=task.observation_sha256,
            render_sha256=task.image.sha256,
            previous_page=nodes[edge.previous_id].page,
            next_page=nodes[edge.next_id].page,
            conflicting_fields=fields,
        )

    def bind_task(self, task: BookRefinementTask) -> None:
        # Task5 validates a private Task3 view. Diagnostics must name the original
        # provider task, while retaining the same source, crops and edge owners.
        f = self.finding

        def digest(value: str) -> str:
            return hashlib.sha256(value.encode()).hexdigest()

        nodes = {digest(n.id): n.page for n in task.nodes}
        if (
            task.source_sha256 != self.source_sha256
            or task.observation_sha256 != f.observation_sha256
            or task.image.sha256 != f.render_sha256
            or nodes.get(f.previous_id_sha256) != f.previous_page
            or nodes.get(f.next_id_sha256) != f.next_page
            or not any(
                digest(e.id) == f.edge_id_sha256
                and digest(e.previous_id) == f.previous_id_sha256
                and digest(e.next_id) == f.next_id_sha256
                for e in task.edges
            )
        ):
            return  # Never attach unrelated identity to an existing strict refusal.
        self.finding = f.model_copy(update={"task_id_sha256": digest(task.task_id)})
