"""Replay checked benchmark candidates; never treat benchmark gold as source evidence."""

from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path
from typing import Any, Literal

from .extract import crop_asset, inspect_pdf, render_page, sha256_file
from .models import Asset, Block, Book, Claim, Evidence, Issue, Page, Style
from .reconstruction import (
    chapters_from_plan,
    digest_text,
    inline_spans,
    join_continuations,
    resolve_notes,
)

MAX_JSON_BYTES = 32 * 1024 * 1024


def _json_file(root: Path, relative: str) -> Any:
    path = root / relative
    if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink():
        raise ValueError("Benchmark artifact escaped its declared run")
    if not path.is_file() or path.stat().st_size > MAX_JSON_BYTES:
        raise ValueError(f"Missing or oversized benchmark artifact {relative}")

    def unique_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON object key in benchmark artifact")
            result[key] = value
        return result

    with path.open(encoding="utf-8") as stream:
        return json.load(stream, object_pairs_hook=unique_keys)


def _blocks(raw: dict[str, Any], page: int, artifact_hash: str, issues: list[Issue]) -> list[Block]:
    result = []
    if not isinstance(raw.get("blocks"), list) or len(raw["blocks"]) > 10000:
        raise ValueError("Invalid benchmark block list")
    kinds: dict[str, Literal["heading", "paragraph", "quote", "code", "note", "list_item"]] = {
        "heading": "heading",
        "paragraph": "paragraph",
        "quote": "quote",
        "code": "code",
        "footnote": "note",
        "list": "list_item",
        "table": "paragraph",
    }
    for index, candidate in enumerate(raw["blocks"], 1):
        if not isinstance(candidate, dict):
            raise ValueError("Invalid benchmark block")
        block_id = candidate.get("id", f"p{page:04d}-b{index:04d}")
        kind = candidate.get("type")
        if kind in {"running_header", "running_footer", "page_number"}:
            issues.append(
                Issue(
                    code="source_furniture_excluded",
                    message=f"Block {block_id}, {kind}, sha256={artifact_hash}.",
                    severity="info",
                    page=page,
                    block_id=block_id,
                )
            )
            continue
        if kind == "figure":
            continue  # Original composition is rendered in the asset pass.
        if kind not in kinds:
            raise ValueError(f"Unsupported benchmark block type {kind!r}")
        text = candidate.get("text")
        if not isinstance(text, str):
            raise ValueError("Canonical benchmark text is required")
        markup = candidate.get("html")
        if markup is not None and not isinstance(markup, str):
            raise ValueError("Invalid benchmark inline HTML")
        spans, warnings = inline_spans(text, markup)
        for warning in warnings:
            issues.append(
                Issue(
                    code=warning,
                    message="Exact unique formatted fragment aligned to canonical text."
                    if warning in {"inline_fragment_aligned", "inline_reference_spacing_aligned"}
                    else "Canonical text retained; inline candidate needs review.",
                    severity="info"
                    if warning in {"inline_fragment_aligned", "inline_reference_spacing_aligned"}
                    else "review",
                    page=page,
                    block_id=block_id,
                )
            )
        if kind == "table":
            issues.append(
                Issue(
                    code="table_semantics_unsupported",
                    message="Table text retained; cell relationships need reconstruction.",
                    page=page,
                    block_id=block_id,
                )
            )
        if kind == "list":
            issues.append(
                Issue(
                    code="list_structure_requires_review",
                    message="Canonical list text retained; item hierarchy requires review.",
                    page=page,
                    block_id=block_id,
                )
            )
        for name in ("continues_from_previous", "continues_to_next"):
            if name in candidate and type(candidate[name]) is not bool:
                raise ValueError("Invalid continuation flag")
        result.append(
            Block(
                id=block_id,
                kind=kinds[kind],
                text=text,
                text_sha256=digest_text(text),
                spans=spans,
                evidence=[Evidence(page=page, method="replay", artifact_sha256=artifact_hash)],
                style=Style(align="center" if kind == "heading" else "start"),
                level=candidate.get("level", 1),
                label=candidate.get("label"),
                continues_from_previous=candidate.get("continues_from_previous", False),
                continues_to_next=candidate.get("continues_to_next", False),
            )
        )
    return result


def import_benchmark(pdf: Path, run: Path, asset_root: Path) -> Book:
    inspection = inspect_pdf(pdf)
    source_hash = inspection["source_sha256"]
    count = inspection["page_count"]
    plan = _json_file(run, "book-plan-finalized.json")
    if not isinstance(plan, dict):
        raise ValueError("Finalized plan must be an object")
    finalization = plan.get("finalization", {})
    if not isinstance(finalization, dict) or finalization.get("source_sha256") != source_hash:
        raise ValueError("Benchmark plan source hash mismatch")
    if finalization.get("source_page_count") != count:
        raise ValueError("Benchmark plan page count mismatch")
    page_hashes = finalization.get("candidate_page_sha256")
    required = {f"pages/{number:04d}.json" for number in range(1, count + 1)}
    if not isinstance(page_hashes, dict) or set(page_hashes) != required:
        raise ValueError("Benchmark plan must bind every source page exactly once")
    config = _json_file(run, "config.json")
    if not isinstance(config, dict) or config.get("source_sha256") != source_hash:
        raise ValueError("Benchmark config source mismatch")
    if (
        finalization.get("run_config_sha256")
        and sha256_file(run / "config.json") != finalization["run_config_sha256"]
    ):
        raise ValueError("Benchmark config changed since plan finalization")
    issues = [
        Issue(
            code="replayed_extraction_requires_review",
            message="Replayed candidates need text, style, note and image verification.",
        ),
        Issue(
            code="print_style_not_measured",
            message="Legacy extraction lacks original typography; styling is a design candidate.",
        ),
    ]
    if finalization.get("status") != "complete":
        issues.append(
            Issue(
                code="chapter_plan_requires_review",
                message="Imported plan has unresolved finalization findings.",
            )
        )
    pages: list[Page] = []
    assets: dict[str, Asset] = {}
    with tempfile.TemporaryDirectory(prefix="ava-replay-render-") as temporary:
        cache: dict[int, Path] = {}
        for number in range(1, count + 1):
            relative = f"pages/{number:04d}.json"
            raw = _json_file(run, relative)
            artifact_hash = sha256_file(run / relative)
            if artifact_hash != page_hashes[relative]:
                raise ValueError(f"Benchmark page {number} changed since finalization")
            if (
                not isinstance(raw, dict)
                or type(raw.get("page_index")) is not int
                or raw["page_index"] != number
            ):
                raise ValueError("Benchmark page identity mismatch")
            if not isinstance(raw.get("warnings", []), list):
                raise ValueError("Invalid benchmark warnings")
            page_issues: list[Issue] = []
            blocks = _blocks(raw, number, artifact_hash, page_issues)
            by_id = {b.id: b for b in blocks}
            for index, candidate in enumerate(raw["blocks"], 1):
                if candidate.get("type") != "figure":
                    continue
                bbox = candidate.get("bbox")
                if (
                    not isinstance(bbox, list)
                    or len(bbox) != 4
                    or any(type(v) not in {int, float} for v in bbox)
                ):
                    raise ValueError("Benchmark figure needs an exact normalized source region")
                if number not in cache:
                    cache[number] = Path(temporary) / f"{number:04d}.png"
                    render_page(pdf, number, cache[number])
                caption = candidate.get("caption") or ""
                if not isinstance(caption, str):
                    raise ValueError("Invalid figure caption")
                normalized_box = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
                asset = crop_asset(
                    pdf,
                    number,
                    normalized_box,
                    asset_root,
                    caption or "Source illustration; description not verified",
                    cache,
                )
                assets.setdefault(asset.id, asset)
                block_id = candidate.get("id", f"p{number:04d}-b{index:04d}")
                by_id[block_id] = Block(
                    id=block_id,
                    kind="figure",
                    text=caption,
                    asset_id=asset.id,
                    evidence=[
                        Evidence(
                            page=number,
                            method="replay",
                            bbox=normalized_box,
                            coordinate_space="normalized_top_left",
                            artifact_sha256=artifact_hash,
                        )
                    ],
                )
                page_issues.append(
                    Issue(
                        code="figure_crop_requires_review",
                        message="Source crop, caption and description require review.",
                        page=number,
                        block_id=block_id,
                    )
                )
            # Restore original reading order, including figures interleaved among paragraphs.
            ordered = [
                by_id[candidate.get("id", f"p{number:04d}-b{index:04d}")]
                for index, candidate in enumerate(raw["blocks"], 1)
                if candidate.get("id", f"p{number:04d}-b{index:04d}") in by_id
            ]
            if raw.get("warnings"):
                page_issues.append(
                    Issue(
                        code="source_recognition_warnings",
                        message=f"Recognition warnings retained in artifact {artifact_hash}.",
                        page=number,
                    )
                )
            info = inspection["pages"][number - 1]
            pages.append(
                Page(
                    number=number,
                    label=raw.get("printed_page"),
                    width=info["width"],
                    height=info["height"],
                    route="replay",
                    blocks=ordered,
                    issues=page_issues,
                )
            )
        # This is explicitly a title-page facsimile candidate, never a claimed original cover.
        cache.setdefault(1, Path(temporary) / "0001.png")
        if not cache[1].exists():
            render_page(pdf, 1, cache[1])
        cover = crop_asset(
            pdf,
            1,
            (0.0, 0.0, 1.0, 1.0),
            asset_root,
            "Source first-page preview; original cover not verified",
            cache,
        )
        assets.setdefault(cover.id, cover)
    entries = plan.get("chapters", [])
    if (
        not isinstance(entries, list)
        or len(entries) > 10000
        or not all(isinstance(e, dict) for e in entries)
    ):
        raise ValueError("Invalid candidate chapter plan")
    chapters, chapter_issues = chapters_from_plan(pages, entries)
    if not chapters:
        raise ValueError("Benchmark contains no readable content")
    issues.extend(chapter_issues)
    issues.extend(resolve_notes(pages))
    issues.extend(join_continuations(pages, chapters))
    issues.append(
        Issue(
            code="cover_is_source_preview",
            message="Cover is a labeled first-page preview, not verified original cover artwork.",
            severity="info",
        )
    )
    metadata = []
    original = plan.get("metadata", {})
    if not isinstance(original, dict):
        raise ValueError("Invalid benchmark metadata")
    for key, value in original.items():
        if isinstance(value, str) and value.strip() and re.fullmatch(r"[a-z][a-z0-9_]{0,63}", key):
            metadata.append(Claim(field=key, value=value, status="candidate", evidence=[]))
    return Book(
        source_sha256=source_hash,
        page_count=count,
        pages=pages,
        chapters=chapters,
        metadata=metadata,
        assets=list(assets.values()),
        cover_asset_id=cover.id,
        issues=issues,
    )
