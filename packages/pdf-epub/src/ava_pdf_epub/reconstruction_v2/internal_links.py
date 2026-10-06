"""Resolve explicit printed-reference text only when one exact target is present."""

from .assembly_state import AssemblyState
from .text_nodes import text_nodes


def internal_links(state: AssemblyState, owners: dict[str, str]) -> None:
    nodes = list(text_nodes(state))
    by_id = {node["id"]: (node, owner) for node, owner, _ in nodes}
    for index, (origin, start, end, target, offset) in enumerate(state.internal_targets):
        origin, delta = _resolve(origin, state)
        target, shift = _resolve(target, state)
        if origin not in by_id or target not in owners:
            raise ValueError("Source reference anchor disappeared during reconstruction")
        node, _ = by_id[origin]
        node["content"]["spans"].append(
            dict(
                id=f"{origin}-source-reference{index}",
                start=start + delta,
                end=end + delta,
                link=dict(
                    kind="internal",
                    chapter_id=owners[target],
                    block_id=target,
                    offset=offset + shift,
                ),
            )
        )
    for node, _parent, spans in nodes:
        for index, span in enumerate(spans):
            if not span.target_text:
                continue
            matches = [
                (candidate, container)
                for candidate, container, _ in nodes
                if candidate["id"] != node["id"]
                and candidate["content"]["text"] == span.target_text
            ]
            if len(matches) != 1:
                raise ValueError("Printed internal reference is missing or ambiguous")
            target_node, container = matches[0]
            node["content"]["spans"].append(
                dict(
                    id=f"{node['id']}-internal{index}",
                    start=span.start,
                    end=span.end,
                    link=dict(
                        kind="internal",
                        chapter_id=owners[container],
                        block_id=target_node["id"],
                        offset=0,
                    ),
                )
            )


def _resolve(ident: str, state: AssemblyState) -> tuple[str, int]:
    offset = 0
    seen = set()
    while ident in state.aliases:
        if ident in seen:
            raise ValueError("Cyclic source reference alias")
        seen.add(ident)
        ident, delta = state.aliases[ident]
        if type(delta) is not int or delta < 0:
            raise ValueError(
                "Source reference alias offset must be a nonnegative codepoint integer"
            )
        offset += delta
    return ident, offset
