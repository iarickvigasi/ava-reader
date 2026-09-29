"""The address registry covers every chapter, block/cell and inline occurrence."""

from typing import TYPE_CHECKING

from .blocks import BlockBase, HeadingBlock, ListItemBlock, NoteBlock, ProseBlock, TableCell
from .common import unique
from .links import InternalTarget, NoteTarget

if TYPE_CHECKING:
    from .book import CanonicalBookV2

TextNode = ProseBlock | HeadingBlock | ListItemBlock | NoteBlock | TableCell
TEXT_NODES = (ProseBlock, HeadingBlock, ListItemBlock, NoteBlock, TableCell)


def check_target(
    target: InternalTarget | NoteTarget, nodes: dict[str, BlockBase], owners: dict[str, str]
) -> None:
    node = nodes.get(target.block_id)
    if node is None or owners[node.id] != target.chapter_id:
        raise ValueError("Target chapter/block identity does not resolve")
    length = len(node.content.text) if isinstance(node, TEXT_NODES) else 0
    if target.offset > length:
        raise ValueError("Target offset outside exact canonical text")
    if isinstance(target, NoteTarget) and not isinstance(node, NoteBlock):
        raise ValueError("Note callout must target a note body")


def validate_links(
    book: "CanonicalBookV2", nodes: dict[str, BlockBase], owners: dict[str, str]
) -> None:
    chapters = {c.id: c for c in book.chapters}
    inline = {
        s.id: (n, s) for n in nodes.values() if isinstance(n, TEXT_NODES) for s in n.content.spans
    }
    ids = [s.id for n in nodes.values() if isinstance(n, TEXT_NODES) for s in n.content.spans]
    unique(list(nodes) + list(chapters) + ids, "addressable identity")
    calls: dict[str, list[str]] = {}
    for ident, (_, span) in inline.items():
        if isinstance(span.link, (InternalTarget, NoteTarget)):
            check_target(span.link, nodes, owners)
        if isinstance(span.link, NoteTarget):
            calls.setdefault(span.link.block_id, []).append(ident)
    for node in nodes.values():
        if isinstance(node, NoteBlock):
            unique(node.callout_ids, "note return identity")
            if set(node.callout_ids) != set(calls.get(node.id, [])):
                raise ValueError("Note returns must match every actual callout exactly")
    seen = set()
    resolved = set()
    for address in book.addresses:
        key = (address.resource_path, address.fragment)
        if key in seen:
            raise ValueError("Duplicate resource/fragment address")
        seen.add(key)
        check_target(address.target, nodes, owners)
        chapter = chapters[address.target.chapter_id]
        if address.resource_path not in chapter.resource_paths:
            raise ValueError("Address resource belongs to another chapter")
        expected = None
        if address.fragment in nodes:
            expected = (owners[address.fragment], address.fragment, 0)
        elif address.fragment in inline:
            node, span = inline[address.fragment]
            expected = (owners[node.id], node.id, span.start)
        elif address.fragment in chapters:
            ch = chapters[address.fragment]
            expected = (ch.id, ch.block_ids[0], 0)
        actual = (address.target.chapter_id, address.target.block_id, address.target.offset)
        if expected is None or actual != expected:
            raise ValueError("Address identity does not match its canonical target")
        resolved.add(address.fragment)
    if resolved != set(nodes) | set(chapters) | set(ids):
        raise ValueError("Address registry must cover all addressable identities")
    prior = set()
    for entry in book.toc:
        if entry.id in prior or (entry.parent_id is not None and entry.parent_id not in prior):
            raise ValueError("TOC identities are unique and parents must precede children")
        prior.add(entry.id)
        check_target(entry.target, nodes, owners)
    if not set(chapters) <= {t.target.chapter_id for t in book.toc}:
        raise ValueError("TOC must account for every chapter")
