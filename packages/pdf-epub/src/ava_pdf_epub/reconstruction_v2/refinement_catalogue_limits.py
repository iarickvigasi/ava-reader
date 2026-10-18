"""Keep model-request bounds separate from the already bounded canonical book."""

from .assembly_state import AssemblyState

TASK_NODE_LIMIT = 256
BOOK_NODE_LIMIT = 20_000  # Matches the canonical book block/graph bound.


def catalogue_limit(state: AssemblyState, source_title_policy: str | None) -> int:
    current = (
        source_title_policy == state.source_title_policy == "ava-frontmatter-title-1"
        and state.source_continuation_policy == "ava-source-continuation-presentation-1"
    )
    return BOOK_NODE_LIMIT if current else TASK_NODE_LIMIT
