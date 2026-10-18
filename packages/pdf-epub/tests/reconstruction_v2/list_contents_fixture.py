"""Authored PDF outline and assembly observations, not source-qualification fixtures."""

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assemble_chapters import assemble_chapters
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links
from ava_pdf_epub.reconstruction_v2.source_structure import source_structure

from .metadata_helpers import heading, metadata_state, paragraph
from .native_size_fixture import document


def rows():
    state = metadata_state(
        [
            heading("Contents", method="ocr"),
            dict(
                kind="list_item", text="Harbour 1", method="ocr", list_ordered=False, list_depth=1
            ),
            dict(
                kind="list_item",
                text="Orchard 2",
                method="ocr",
                list_ordered=True,
                list_start=2,
                list_depth=1,
            ),
            heading("Harbour", page=2),
            paragraph("The harbour has ordinary prose.", page=2),
            heading("Orchard", page=3),
            paragraph("The orchard also has ordinary prose.", page=3),
        ]
    )
    state.evidence = {block["id"]: block["evidence"] for block in state.blocks}
    state.blocks.clear()
    state.source_title_policy = "ava-frontmatter-title-1"
    for s in state.segments.values():
        state.placements[s.id] = (s.page, 0, 0)
    return state


def assemble(root, *, conflicting=False):
    source = root / "source.pdf"
    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=600, height=800)
    writer.add_outline_item("Harbour", 1)
    writer.add_outline_item("Orchard", 2)
    writer.write(source)
    state = rows()
    original = list(state.segments.values())
    _, prepared = document([(s, []) for s in original])
    qualified = {p.observation.number: [] for p in prepared}
    for page, label in [(2, "1"), (3, "2")]:
        qualified[page] = [
            original[0].model_copy(update={"kind": "furniture", "text": label, "page": page})
        ]
    for row, target in [(original[1], original[3]), (original[2], original[5])]:
        destination = original[5] if conflicting and row == original[1] else target
        state.internal_targets.append((row.id, 0, len(row.text), destination.id, 0))
    actual = source_structure(source, prepared, qualified, original, state)
    state.segments.update({s.id: s for s in actual})
    assemble_blocks(actual, prepared, root, state)
    chapters, toc = assemble_chapters(state)
    internal_links(state, {b: c["id"] for c in chapters for b in c["block_ids"]})
    return original, actual, state, chapters, toc
