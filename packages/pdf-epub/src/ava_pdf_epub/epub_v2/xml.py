"""Small XHTML builders; all content goes through XML escaping."""

import xml.etree.ElementTree as ET

XHTML = "http://www.w3.org/1999/xhtml"
EPUB = "http://www.idpf.org/2007/ops"
ET.register_namespace("", XHTML)
ET.register_namespace("epub", EPUB)


def element(tag: str, attrs: dict[str, str] | None = None, text: str | None = None) -> ET.Element:
    node = ET.Element(f"{{{XHTML}}}{tag}", attrs or {})
    node.text = text
    return node


def append_text(node: ET.Element, text: str) -> None:
    if len(node):
        node[-1].tail = (node[-1].tail or "") + text
    else:
        node.text = (node.text or "") + text


def document(title: str, body: ET.Element, language: str = "en") -> bytes:
    root = element(
        "html", {"lang": language, "{http://www.w3.org/XML/1998/namespace}lang": language}
    )
    head = ET.SubElement(root, f"{{{XHTML}}}head")
    head.append(element("title", text=title))
    head.append(element("link", {"rel": "stylesheet", "href": "../styles/book.css"}))
    root.extend([body])
    data = bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))
    return data.replace(b"\r", b"&#13;")
