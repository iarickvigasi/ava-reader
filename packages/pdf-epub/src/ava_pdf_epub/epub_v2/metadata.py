"""Accepted EPUB metadata, keeping source-edition identity distinct from conversion identity."""

import xml.etree.ElementTree as ET

from ..contracts.book import CanonicalBookV2
from ..contracts.common import document_digest

DC = "http://purl.org/dc/elements/1.1/"


def metadata_element(book: CanonicalBookV2) -> ET.Element:
    root = ET.Element("metadata", {"xmlns:dc": DC})
    accepted = [m for m in book.metadata if m.status == "accepted"]
    ids = [m.value for m in accepted if m.field == "identifier" and m.scope == "conversion"]
    if len(set(ids)) > 1:
        raise ValueError("Ambiguous accepted conversion identifier")
    identifier = ids[0] if len(set(ids)) == 1 else "urn:sha256:" + document_digest(book)
    ET.SubElement(root, "dc:identifier", {"id": "book-id"}).text = identifier
    titles = [m.value for m in accepted if m.field == "title"]
    if len(set(titles)) > 1:
        raise ValueError("Ambiguous accepted title")
    ET.SubElement(root, "dc:title", {"id": "main-title"}).text = (
        titles[0] if len(set(titles)) == 1 else "Untitled book"
    )
    languages = [m.value for m in accepted if m.field == "language"]
    if len(set(languages)) > 1 or any(not s or s.split("-")[0] != "en" for s in languages):
        raise ValueError("Unsupported or ambiguous accepted language")
    ET.SubElement(root, "dc:language").text = languages[0] if languages else "en"
    ET.SubElement(root, "meta", {"property": "dcterms:modified"}).text = "2000-01-01T00:00:00Z"
    ET.SubElement(root, "meta", {"property": "rendition:layout"}).text = "reflowable"
    for claim in accepted:
        if claim.field in {"title", "language"} or claim.scope == "conversion":
            continue
        tag = {
            "subtitle": "title",
            "contributor": "contributor",
            "identifier": "source",
            "edition": "source",
        }.get(claim.field, claim.field)
        if claim.contributor_role == "author":
            tag = "creator"
        key = "claim-" + claim.id
        ET.SubElement(root, "dc:" + tag, {"id": key}).text = claim.value
        for property_, value in [("ava:scope", claim.scope), ("ava:origin", claim.origin)]:
            ET.SubElement(root, "meta", {"refines": "#" + key, "property": property_}).text = value
        if claim.field == "subtitle":
            ET.SubElement(
                root, "meta", {"refines": "#" + key, "property": "title-type"}
            ).text = "subtitle"
        if claim.identifier_scheme:
            ET.SubElement(
                root, "meta", {"refines": "#" + key, "property": "ava:identifier-scheme"}
            ).text = claim.identifier_scheme
        if claim.contributor_role:
            role = {
                "author": "aut",
                "translator": "trl",
                "editor": "edt",
                "illustrator": "ill",
                "other": "ctb",
            }[claim.contributor_role]
            ET.SubElement(
                root, "meta", {"refines": "#" + key, "property": "role", "scheme": "marc:relators"}
            ).text = role
    return root
