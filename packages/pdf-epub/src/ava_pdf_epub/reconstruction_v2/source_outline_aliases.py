"""Preserve known frontmatter bookmark labels without fabricating printed headings."""

import hashlib
import re
from dataclasses import replace
from typing import Any

from .assembly_state import AssemblyState
from .findings import Finding
from .structure_claims import StructureClaim, title_key

_LABELS = {
    "cover",
    "front cover",
    "title",
    "title page",
    "half title",
    "half-title",
    "copyright",
    "publication details",
    "colophon",
    "contents",
    "table of contents",
    "dedication",
    "epigraph",
    "also by the author",
}


def known_frontmatter_bookmark(text: str) -> bool:
    label = title_key(text)
    return (
        label in _LABELS
        or label.startswith("also available from ")
        or bool(re.match(r"^(?:title|isbn)\s*[: ]", label))
    )


def _alias(
    state: AssemblyState, claim: StructureClaim, page: int, parent: tuple[str, int, int] | None
) -> None:
    state.source_outline_alias_parents[len(state.source_outline_aliases)] = parent
    state.source_outline_aliases.append((claim.title, page, claim.depth or 0))


def separate_outline_aliases(
    outline: list[StructureClaim],
    printed: list[StructureClaim],
    first_body_page: int,
    state: AssemblyState,
    *,
    folios: dict[str, int] | None = None,
) -> list[StructureClaim]:
    result = []
    printed_keys = {title_key(claim.title) for claim in printed}
    levels: dict[int, tuple[str, int, int]] = {}
    for claim in outline:
        label = title_key(claim.title)
        page = claim.pdf_page
        if page is None:
            result.append(claim)
            continue
        depth = claim.depth or 0
        parent = levels.get(depth - 1) if depth else None
        if depth and parent is None:
            raise ValueError("Source outline ancestry has no preceding parent")
        levels = {rank: value for rank, value in levels.items() if rank < depth}
        levels[depth] = (label, page, depth)
        known = known_frontmatter_bookmark(claim.title)
        from .navigation_alias_key import dash_alias_offsets, navigation_alias_key

        counterparts = [
            c
            for c in printed
            if navigation_alias_key(c.title) == navigation_alias_key(claim.title)
            and (
                c.pdf_page
                if c.pdf_page is not None
                else (folios or {}).get((c.printed_page or "").casefold())
            )
            == page
        ]
        if len(counterparts) > 1:
            raise ValueError("Outline alias has ambiguous printed source targets")
        if counterparts and title_key(counterparts[0].title) != label:
            offsets = dash_alias_offsets(counterparts[0].title, claim.title)
            printed_claim = counterparts[0]
            if printed_claim.depth is not None and printed_claim.depth != claim.depth:
                raise ValueError("Printed contents and outline alias hierarchy disagree")
            printed[printed.index(printed_claim)] = replace(printed_claim, depth=claim.depth)
            _alias(state, claim, page, parent)
            state.structure_findings.append(
                Finding(
                    code="SOURCE_OUTLINE_DASH_ALIAS",
                    severity="information",
                    page=page,
                    block_id=counterparts[0].source_id,
                    message=(
                        "Unchanged printed/bookmark labels use witnessed hyphen/en-dash aliases "
                        "at normalized offsets: "
                    )
                    + ",".join(str(at) for at in offsets),
                )
            )
            continue
        if (
            page is not None
            and 1 <= page <= min(16, first_body_page - 1)
            and known
            and label not in printed_keys
        ):
            if not claim.title.strip() or len(claim.title) > 1000:
                raise ValueError("Frontmatter bookmark label exceeds navigation bounds")
            _alias(state, claim, page, parent)
        else:
            result.append(claim)
    return result


def add_outline_navigation(
    state: AssemblyState,
    chapters: list[dict[str, Any]],
    toc: list[dict[str, Any]],
    addresses: list[dict[str, Any]],
) -> None:
    if not state.source_outline_aliases:
        return
    # The stock page-address compiler already checked source owner, join offset and projection.
    page_addresses = {a["source_page"]: a for a in addresses if "source_page" in a}
    from .internal_links import _resolve
    from .navigation_alias_key import navigation_alias_key

    alias_ids = {}
    for index, (label, page, depth) in enumerate(state.source_outline_aliases):
        key = (title_key(label), page, depth)
        if key in alias_ids:
            raise ValueError("Repeated source outline alias identity")
        digest = hashlib.sha256(f"{index}:{page}:{depth}:{label}".encode()).hexdigest()[:24]
        alias_ids[key] = "toc-source-outline-" + digest
    for index, (label, page, depth) in enumerate(state.source_outline_aliases):
        address = page_addresses.get(page)
        if address is None:
            raise ValueError("Frontmatter bookmark destination has no checked source-page address")
        target = dict(address["target"])
        ident = target["block_id"]
        owner = next(b for b in state.blocks if b["id"] == ident)
        digest = hashlib.sha256(f"{index}:{page}:{depth}:{label}".encode()).hexdigest()[:24]
        entry: dict[str, Any] = dict(id="toc-source-outline-" + digest, label=label, target=target)
        if depth:
            parent_key = state.source_outline_alias_parents.get(index)
            if parent_key is None:
                raise ValueError("Source bookmark ancestry has no recorded source parent")
            parent_id = alias_ids.get(parent_key)
            if parent_id is None:
                source_parent = state.source_outline_targets.get(parent_key)
                if source_parent is None:
                    raise ValueError("Source bookmark ancestry has no corroborated parent target")
                parent_target, parent_offset = _resolve(source_parent, state)
                parents = [
                    candidate
                    for candidate in toc
                    if candidate["target"]["block_id"] == parent_target
                    and candidate["target"]["offset"] == parent_offset
                    and navigation_alias_key(candidate["label"])
                    == navigation_alias_key(parent_key[0])
                ]
                if len(parents) != 1:
                    raise ValueError(
                        "Source bookmark ancestry has no unique existing navigation parent"
                    )
                parent_id = parents[0]["id"]
            entry["parent_id"] = parent_id
        toc.append(entry)
        state.structure_findings.append(
            Finding(
                code="SOURCE_OUTLINE_ALIAS_PRESERVED",
                severity="information",
                page=page,
                block_id=owner["id"],
                message="PDF bookmark retained as navigation label: " + label,
            )
        )
    positions = {b["id"]: i for i, b in enumerate(state.blocks)}
    toc.sort(key=lambda entry: (positions[entry["target"]["block_id"]], entry["target"]["offset"]))
    prior: set[str] = set()
    for entry in toc:
        if "parent_id" in entry and entry["parent_id"] not in prior:
            raise ValueError("Source bookmark destination order conflicts with navigation ancestry")
        prior.add(entry["id"])
