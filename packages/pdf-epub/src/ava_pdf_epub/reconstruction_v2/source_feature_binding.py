"""Bind each source appearance to its exact immutable range in the finished canonical block."""

from .assembly_state import AssemblyState


def bind_source_features(state: AssemblyState) -> None:
    for evidence in state.source_feature_evidence:
        ident, offset, seen = evidence["node_id"], 0, set()
        while ident in state.aliases:
            if ident in seen:
                raise ValueError("Source feature alias cycle")
            seen.add(ident)
            ident, shift = state.aliases[ident]
            offset += shift
        evidence.update(canonical_block_id=ident, canonical_start=offset)
