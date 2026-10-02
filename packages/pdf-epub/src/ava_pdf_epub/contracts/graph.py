"""Semantic validation is mandatory in addition to the generated JSON Schema."""

from typing import TYPE_CHECKING

from .graph_assets import validate_assets
from .graph_index import index_book
from .graph_links import TEXT_NODES, validate_links
from .graph_source import validate_source
from .graph_structure import validate_lists, validate_tables

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def validate_book(book: "CanonicalBookV2") -> None:
    from .profiles import BILINGUAL_PROFILE, package_language

    if book.profile_id == BILINGUAL_PROFILE:
        package_language(book)
    nodes, owners = index_book(book)
    if book.profile_id == BILINGUAL_PROFILE and any(
        isinstance(node, TEXT_NODES) and node.content.language is None for node in nodes.values()
    ):
        raise ValueError("Extended profile requires explicit passage language")
    validate_source(book, nodes)
    validate_tables(nodes)
    validate_lists(book, nodes, owners)
    validate_links(book, nodes, owners)
    validate_assets(book, nodes, owners)
