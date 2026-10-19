import copy
import json
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.assemble_addresses import assemble_addresses
from ava_pdf_epub.reconstruction_v2.assemble_page_addresses import assemble_page_addresses
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.segments import Segment
from ava_pdf_epub.reconstruction_v2.source_page_starts import capture_page_starts
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins


def joined_book(parts, *, preserve=False, physical_pages=None):
    numbers = physical_pages or list(range(1, len(parts) + 1))
    state = AssemblyState()
    segments, pages = [], {}
    for index, (text, number) in enumerate(zip(parts, numbers, strict=True)):
        column = (
            (2 if index and number == numbers[index - 1] else 1) if numbers.count(number) > 1 else 0
        )
        box = Box(
            coordinate_space="page_points_top_left",
            x0=20 if column == 1 else 170,
            y0=60 if column == 1 else 20,
            x1=130 if column == 1 else 280,
            y1=80 if column == 1 else 40,
        )
        segment = Segment(
            id=f"part-{index}",
            page=number,
            kind="paragraph",
            text=text,
            method="native",
            box=box,
            preserve_line_breaks=preserve,
            continues_from_previous=index > 0,
            continues_to_next=index + 1 < len(parts),
        )
        region = f"region-{index}"
        state.evidence[segment.id] = [
            dict(page=number, region_id=region, method="native", box=box.model_dump())
        ]
        state.segments[segment.id] = segment
        state.placements[segment.id] = (number, 0, column)
        pages.setdefault(
            number,
            dict(number=number, width_pt=300, height_pt=300, original_rotation=0, regions=[]),
        )["regions"].append(
            dict(
                id=region,
                box=box.model_dump(),
                band=0,
                column=column,
                role="content",
                route="native",
            )
        )
        segments.append(segment)
    starts = capture_page_starts(segments, state)
    joined = stream_joins(segments, state)
    for node in joined:
        state.blocks.append(
            dict(
                id=node.id,
                kind=node.kind,
                style_id=None,
                evidence=state.evidence[node.id],
                content=canonical_text(node.text, node.spans, node.source_text, node.id, state),
            )
        )
    chapters = [
        dict(
            id="chapter",
            title="Source",
            role="bodymatter",
            resource_paths=["text/source.xhtml"],
            block_ids=[s.id for s in joined],
        )
    ]
    addresses = assemble_addresses(state, chapters)
    assemble_page_addresses(starts, state, chapters, addresses)
    raw = json.loads(
        (Path(__file__).parents[1] / "contracts/fixtures/ava-book-2.json").read_bytes()
    )
    raw.update(
        blocks=state.blocks,
        chapters=chapters,
        spine=["chapter"],
        styles=[],
        resources=[],
        lists=[],
        metadata=[m for m in raw["metadata"] if m["origin"] == "generated"],
        cover_resource_id=None,
        addresses=addresses,
        pages=list(pages.values()),
        toc=[
            dict(
                id="toc",
                label="Source",
                parent_id=None,
                target=dict(kind="internal", chapter_id="chapter", block_id=joined[0].id, offset=0),
            )
        ],
    )
    raw["source"]["page_count"] = max(numbers)
    return CanonicalBookV2.model_validate(raw), segments, state, starts


def rename(value, old, new):
    if isinstance(value, dict):
        return {key: rename(item, old, new) for key, item in value.items()}
    if isinstance(value, list):
        return [rename(item, old, new) for item in value]
    return new if value == old else value


def one_block_book(book, kind):
    raw = copy.deepcopy(book.model_dump())
    blocks = [b for b in raw["blocks"] if b["kind"] == kind]
    if kind not in {"list_item"}:
        blocks = blocks[:1]
    regions = {e["region_id"] for b in blocks for e in b["evidence"]}
    page = raw["pages"][0]
    page["regions"] = [r for r in page["regions"] if r["id"] in regions]
    for index, region in enumerate(page["regions"]):
        region.update(band=index, column=0)
    for block in blocks:
        for key in ("caption_id", "credit_id"):
            if key in block:
                block[key] = None
    raw.update(
        blocks=blocks,
        pages=[page],
        metadata=[m for m in raw["metadata"] if m["origin"] == "generated"],
        cover_resource_id=None,
        resources=raw["resources"] if kind == "figure" else [],
        lists=raw["lists"] if kind == "list_item" else [],
    )
    raw["source"]["page_count"] = 1
    raw["chapters"] = [
        dict(
            id="chapter",
            title="Source",
            role="bodymatter",
            resource_paths=["text/source.xhtml"],
            block_ids=[b["id"] for b in blocks],
        )
    ]
    raw["spine"] = ["chapter"]
    state = AssemblyState(blocks=blocks)
    raw["addresses"] = assemble_addresses(state, raw["chapters"])
    raw["addresses"].append(
        dict(
            resource_path="text/source.xhtml",
            fragment="ava-source-page-1",
            source_page=1,
            target=dict(kind="internal", chapter_id="chapter", block_id=blocks[0]["id"], offset=0),
        )
    )
    raw["toc"] = [
        dict(id="toc", label="Source", parent_id=None, target=raw["addresses"][-1]["target"])
    ]
    return CanonicalBookV2.model_validate(raw)
