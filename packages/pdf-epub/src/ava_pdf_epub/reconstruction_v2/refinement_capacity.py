"""Book task capacity is distinct from per-task semantic and byte limits."""

from .continuation_presentation_contract import POLICY

HISTORICAL_REFINEMENT_TASK_LIMIT = 32
CURRENT_REFINEMENT_TASK_LIMIT = 64


def refinement_task_limit(continuation_policy: str | None) -> int:
    return (
        CURRENT_REFINEMENT_TASK_LIMIT
        if continuation_policy == POLICY
        else HISTORICAL_REFINEMENT_TASK_LIMIT
    )
