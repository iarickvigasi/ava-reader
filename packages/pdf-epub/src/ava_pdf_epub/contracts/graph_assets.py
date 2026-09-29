"""Source styles, resources, metadata and aggregate content bounds."""

from typing import TYPE_CHECKING

from .blocks import BlockBase, FigureBlock, ProseBlock, TableBlock
from .common import unique
from .graph_links import TEXT_NODES

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def validate_assets(
    book: "CanonicalBookV2", nodes: dict[str, BlockBase], owners: dict[str, str]
) -> None:
    unique([s.id for s in book.styles], "style")
    unique([r.id for r in book.resources], "resource")
    unique([r.path for r in book.resources], "resource path")
    unique([c.id for c in book.metadata], "metadata claim")
    paths = [p for c in book.chapters for p in c.resource_paths] + [r.path for r in book.resources]
    unique(paths, "publication resource path")
    styles = {s.id for s in book.styles}
    resources = {r.id for r in book.resources}
    if book.cover_resource_id is not None and book.cover_resource_id not in resources:
        raise ValueError("Unknown cover resource")
    used = {n.resource_id for n in nodes.values() if isinstance(n, FigureBlock)}
    if book.cover_resource_id is not None:
        used.add(book.cover_resource_id)
    if used != resources:
        raise ValueError("Every resource must be used by a figure or the identified cover")
    total_text = 0
    for node in nodes.values():
        refs = [node.style_id]
        if isinstance(node, TEXT_NODES):
            total_text += len(node.content.text.encode("utf-8"))
            refs.extend(s.style_id for s in node.content.spans)
        if any(r is not None and r not in styles for r in refs):
            raise ValueError("Unknown style identity")
        if isinstance(node, ProseBlock) and node.kind in {"verse", "code"}:
            lines = node.content.text.split("\n")
            if len(lines) > 80 or any(len(line) > 4096 for line in lines):
                raise ValueError("Literal block exceeds selected line bounds")
        if isinstance(node, FigureBlock):
            if node.resource_id not in resources:
                raise ValueError("Figure resource does not exist")
            if node.decorative != (node.alt == ""):
                raise ValueError("Decorative figures use empty alt; meaningful figures require alt")
            related = [(node.caption_id, "caption"), (node.credit_id, "credit")]
        elif isinstance(node, TableBlock):
            related = [(node.caption_id, "caption")]
        else:
            related = []
        for ident, kind in related:
            if ident is None:
                continue
            target = nodes.get(ident)
            if (
                not isinstance(target, ProseBlock)
                or target.kind != kind
                or owners[ident] != owners[node.id]
            ):
                raise ValueError("Figure/table caption or credit must resolve in its chapter")
    if total_text > 20971520:
        raise ValueError("Aggregate canonical UTF-8 bound exceeded")
    if sum(r.width * r.height * 4 for r in book.resources) > 209715200:
        raise ValueError("Aggregate decoded RGBA resource bound exceeded")
    edition = [
        m
        for m in book.metadata
        if m.field == "identifier" and m.scope == "conversion" and m.status == "accepted"
    ]
    if len(edition) != 1:
        raise ValueError("Exactly one accepted generated-edition identifier is required")
    source_ids = {
        m.value for m in book.metadata if m.field == "identifier" and m.scope != "conversion"
    }
    if edition[0].value in source_ids:
        raise ValueError("Generated edition identity must differ from source identifier")
