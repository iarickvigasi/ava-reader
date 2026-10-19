"""Compose only a uniquely witnessed maximal subtitle run; never suppress substrings."""

from typing import Any

from .assembly_state import AssemblyState
from .metadata_equivalence import metadata_evidence, metadata_key
from .subtitle_source_parts import adjacent_subtitle, subtitle_parts


def compose_subtitles(claims: list[dict[str, Any]], state: AssemblyState) -> list[dict[str, Any]]:
    parts = subtitle_parts(claims, state)
    runs: list[list[int]] = []
    for index, (_, segment) in parts.items():
        if runs and runs[-1][-1] == index - 1 and adjacent_subtitle(parts[index - 1][1], segment):
            runs[-1].append(index)
        else:
            runs.append([index])
    part_claims = {value[0] for value in parts.values()}
    subtitle_owners = {
        state.bibliographic_claim_owners.get(ident, ident)
        for ident, (role, _) in state.bibliographic_roles.items()
        if role == "subtitle"
    }
    plans: list[tuple[set[int], dict[str, Any]]] = []
    for run in runs:
        if not 2 <= len(run) <= 8:
            continue
        if any(
            0 <= i < len(state.blocks) and state.blocks[i]["id"] in subtitle_owners
            for i in (run[0] - 1, run[-1] + 1)
        ):
            # Every selected part must qualify, including uncertain neighboring lines.
            continue
        selected = [parts[index][0] for index in run]
        whole = dict(claims[selected[0]], value=" ".join(parts[i][1].text for i in run))
        key = metadata_key(whole)
        keys = [metadata_key(claims[i]) for i in selected]
        if key is None or any(k is None or k[:-1] != key[:-1] for k in keys):
            continue
        page = parts[run[0]][1].page
        witnesses = [
            i
            for i, claim in enumerate(claims)
            if i not in part_claims
            and metadata_key(claim) == key
            and claim.get("evidence")
            and all(e["page"] != page for e in claim["evidence"])
        ]
        if not witnesses:
            continue
        consumed = {*selected, *witnesses}
        whole["evidence"] = metadata_evidence([claims[i] for i in sorted(consumed)])
        plans.append((consumed, whole))
    replacements: dict[int, dict[str, Any]] = {}
    removed = set()
    for index, (consumed, whole) in enumerate(plans):
        if any(consumed & other for j, (other, _) in enumerate(plans) if index != j):
            continue
        replacements[min(consumed)] = whole
        removed.update(consumed)
    return [
        replacements[i] if i in replacements else c
        for i, c in enumerate(claims)
        if i in replacements or i not in removed
    ]
