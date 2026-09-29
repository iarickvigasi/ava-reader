"""Exact generated-file coordinates, independent of source resource aliases."""

from dataclasses import dataclass

from ..contracts.book import CanonicalBookV2
from ..contracts.graph_index import index_book
from ..contracts.graph_links import TEXT_NODES
from ..contracts.links import ExternalTarget, InternalTarget, NoteTarget


def ident(kind: str, value: str) -> str:
    return kind + "-" + value.encode("utf-8").hex()


@dataclass
class Context:
    book: CanonicalBookV2

    def __post_init__(self) -> None:
        self.nodes, self.owners = index_book(self.book)
        self.paths = {c.id: f"text/{ident('ch', c.id)}.xhtml" for c in self.book.chapters}
        self.styles = {s.id: s for s in self.book.styles}
        self.resources = {r.id: r for r in self.book.resources}
        self.groups = {g.id: g for g in self.book.lists}
        self.inline_owners = {
            s.id: n.id
            for n in self.nodes.values()
            if isinstance(n, TEXT_NODES)
            for s in n.content.spans
        }
        targets: list[InternalTarget | NoteTarget] = [entry.target for entry in self.book.toc]
        targets += [
            s.link
            for n in self.nodes.values()
            if isinstance(n, TEXT_NODES)
            for s in n.content.spans
            if isinstance(s.link, (InternalTarget, NoteTarget))
        ]
        self.offsets: dict[str, set[int]] = {}
        for target in targets:
            if target.offset:
                self.offsets.setdefault(target.block_id, set()).add(target.offset)

    def href(self, target: InternalTarget | NoteTarget | ExternalTarget) -> str:
        if isinstance(target, ExternalTarget):
            return target.url
        fragment = ident("b", target.block_id)
        if target.offset:
            fragment = ident("loc", target.block_id) + f"-{target.offset}"
        return "../" + self.paths[target.chapter_id] + "#" + fragment

    def backlink(self, callout: str) -> str:
        chapter = self.owners[self.inline_owners[callout]]
        return "../" + self.paths[chapter] + "#" + ident("s", callout)
