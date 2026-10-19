"""Local native PDF adapter. Recognition and visual acceptance remain explicit."""

from __future__ import annotations

import hashlib
import math
import re
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Literal, cast

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream, DictionaryObject

from .admission_actions import inspect_annotations, inspect_catalog
from .annotation_kind import annotation_kind
from .annotation_view_cache import POLICY as ANNOTATION_POLICY
from .models import Asset, Block, Book, Claim, Evidence, Issue, Page, Span, Style
from .reconstruction import chapters_from_plan, digest_text

MAX_SOURCE_BYTES = 250 * 1024 * 1024
MAX_PAGES = 5000
MAX_PAGE_CHARS = 200000
MAX_DIMENSION_PT = 14400.0
RENDER_LONG_EDGE = 2400


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _reader(path: Path) -> PdfReader:
    if not path.is_file() or not 0 < path.stat().st_size <= MAX_SOURCE_BYTES:
        raise ValueError("PDF is absent, empty or exceeds the 250 MiB source limit")
    with path.open("rb") as stream:
        if not stream.read(1024).lstrip().startswith(b"%PDF-"):
            raise ValueError("Source is not a PDF")
    reader = PdfReader(path, strict=True)
    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs require a separately authorized decryption step")
    if not 1 <= len(reader.pages) <= MAX_PAGES:
        raise ValueError("PDF page count exceeds supported bounds")
    return reader


def inspect_pdf(path: Path) -> dict[str, Any]:
    """No content or private annotation strings are returned from preflight."""
    reader = _reader(path)
    pages = []
    annotations: list[dict[str, Any]] = []
    for index, page in enumerate(reader.pages, 1):
        width, height = float(page.cropbox.width), float(page.cropbox.height)
        if not all(math.isfinite(v) and 0 < v <= MAX_DIMENSION_PT for v in (width, height)):
            raise ValueError(f"Unsupported page dimensions on page {index}")
        rotation = int(page.rotation) % 360
        if rotation not in {0, 90, 180, 270}:
            raise ValueError("Non-cardinal PDF page rotation requires review")
        if rotation in {90, 270}:
            width, height = height, width
        inspect_annotations(page, page_number=index, page_count=len(reader.pages))
        found = page.get("/Annots", [])
        if found:
            annotations.extend(
                {
                    "page": index,
                    "subtype": str(a.get_object().get("/Subtype", "unknown")),
                    "disposition": annotation_kind(a.get_object()),
                }
                for a in found
            )
        resources = page.get("/Resources", {})
        resources = resources.get_object() if hasattr(resources, "get_object") else resources
        pages.append(
            {
                "page_index": index,
                "width": width,
                "height": height,
                "cropbox": [float(v) for v in page.cropbox],
                "rotation": int(page.rotation),
                "font_resource_count": len(resources.get("/Font", {})),
                "xobject_resource_count": len(resources.get("/XObject", {})),
            }
        )
    root = cast(DictionaryObject, reader.trailer["/Root"])
    inspect_catalog(root)
    metadata = {str(k).removeprefix("/"): str(v)[:4000] for k, v in (reader.metadata or {}).items()}
    outlines: list[dict[str, Any]] = []

    def walk(items: list[Any], depth: int = 0) -> None:
        if depth > 20 or len(outlines) > 10000:
            raise ValueError("Outline resource limit exceeded")
        for entry in items:
            if isinstance(entry, list):
                walk(entry, depth + 1)
            else:
                try:
                    number = reader.get_destination_page_number(entry)
                    title = str(entry.title)
                except (AttributeError, KeyError, ValueError):
                    continue
                if number is not None and 0 <= number < len(reader.pages):
                    outlines.append({"title": title[:1000], "page_index": number + 1})

    walk(reader.outline)
    return {
        "source_sha256": sha256_file(path),
        "page_count": len(pages),
        "metadata": metadata,
        "annotations": annotations,
        "pages": pages,
        "outlines": outlines,
        "page_labels": reader.page_labels,
        "resources": {
            "fonts": sum(p["font_resource_count"] for p in pages),
            "xobjects": sum(p["xobject_resource_count"] for p in pages),
        },
        "appearance_policy": ANNOTATION_POLICY,
    }


def render_page(path: Path, page_number: int, output: Path) -> None:
    executable = shutil.which("pdftoppm")
    if not executable:
        raise RuntimeError("Poppler pdftoppm is required to render source evidence")
    output.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            executable,
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-singlefile",
            "-cropbox",
            "-scale-to",
            str(RENDER_LONG_EDGE),
            "-png",
            str(path.resolve()),
            str(output.with_suffix("")),
        ],
        capture_output=True,
        timeout=60,
        check=False,
    )
    if b"bad appearance for annotation" in result.stderr.lower():
        raise ValueError("PDF_ANNOTATION_RENDER_FAILED")
    if result.returncode or not output.is_file():
        raise RuntimeError(f"Source page {page_number} rendering failed")
    if output.stat().st_size > 64 * 1024 * 1024:
        raise ValueError("Rendered page exceeds resource limit")


def _qualify_native_graphics(path: Path) -> None:
    """Bound initial native support; never recover concealed text through extraction."""
    reader = _reader(path)

    def check(stream: Any, resources: Any, seen: set[int], depth: int) -> None:
        if depth > 12:
            raise ValueError("Nested PDF graphics exceed native adapter limits")
        stream = stream.get_object() if hasattr(stream, "get_object") else stream
        resources = resources.get_object() if hasattr(resources, "get_object") else resources
        identity = id(stream)
        if identity in seen:
            raise ValueError("Cyclic PDF graphics require review")
        seen = seen | {identity}
        contents = ContentStream(stream, reader)
        if len(contents.operations) > 1000000:
            raise ValueError("PDF content operation limit exceeded")
        for operands, operator in contents.operations:
            if operator == b"Tr" and operands and int(operands[0]) != 0:
                raise ValueError("Nonstandard/hidden text rendering requires visible-source review")
            if operator in {b"W", b"W*"}:
                raise ValueError("Clipped native content requires visible-source review")
            if operator == b"gs":
                raise ValueError("Extended graphics state needs visible-source review")
            if operator == b"BDC" and operands and str(operands[0]) == "/OC":
                raise ValueError("Optional-content visibility requires source review")
            if operator == b"Do" and operands:
                obj = resources.get("/XObject", {}).get(operands[0])
                if obj is not None:
                    obj = obj.get_object()
                    if obj.get("/Subtype") == "/Form":
                        check(obj, obj.get("/Resources", resources), seen, depth + 1)

    for page in reader.pages:
        if page.rotation % 360:
            raise ValueError("Rotated native pages require coordinate qualification")
        media, crop = page.mediabox, page.cropbox
        if not (
            media.left <= crop.left < crop.right <= media.right
            and media.bottom <= crop.bottom < crop.top <= media.top
        ):
            raise ValueError("CropBox outside MediaBox requires coordinate qualification")
        contents = page.get_contents()
        if contents is not None:
            check(contents, page.get("/Resources", {}), set(), 0)


def crop_asset(
    path: Path,
    page_number: int,
    bbox: tuple[float, float, float, float],
    asset_root: Path,
    alt: str,
    render_cache: dict[int, Path],
) -> Asset:
    """bbox is normalized to the displayed CropBox; source rendering composes masks/vectors."""
    if not (
        all(math.isfinite(v) for v in bbox)
        and 0 <= bbox[0] < bbox[2] <= 1
        and 0 <= bbox[1] < bbox[3] <= 1
    ):
        raise ValueError("Invalid figure crop")
    asset_root.mkdir(parents=True, exist_ok=True)
    if page_number not in render_cache:
        # Caller keeps this private cache outside exported assets.
        raise ValueError("Figure rendering must be prepared with source preflight")
    with Image.open(render_cache[page_number]) as image:
        image.load()
        box = (
            math.floor(bbox[0] * image.width),
            math.floor(bbox[1] * image.height),
            math.ceil(bbox[2] * image.width),
            math.ceil(bbox[3] * image.height),
        )
        crop = image.crop(box).convert("RGB")
        if crop.width < 2 or crop.height < 2:
            raise ValueError("Figure crop is empty")
        with tempfile.NamedTemporaryFile(suffix=".png", dir=asset_root, delete=False) as stream:
            temporary = Path(stream.name)
        try:
            crop.save(temporary, format="PNG")
            digest = sha256_file(temporary)
            filename = f"{digest}.png"
            destination = asset_root / filename
            if destination.exists() and sha256_file(destination) != digest:
                raise ValueError("Asset hash collision or modified content")
            temporary.replace(destination)
            return Asset(
                id=f"asset-{digest[:24]}",
                path=filename,
                sha256=digest,
                media_type="image/png",
                width=crop.width,
                height=crop.height,
                alt=alt[:4000],
                evidence=[
                    Evidence(
                        page=page_number,
                        method="render",
                        bbox=bbox,
                        coordinate_space="normalized_top_left",
                        artifact_sha256=sha256_file(render_cache[page_number]),
                    )
                ],
            )
        finally:
            temporary.unlink(missing_ok=True)


def _text_blocks(
    chars: list[dict[str, Any]],
    page: int,
    width: float,
    height: float,
    source_hash: str,
    synthetic: bool,
) -> list[Block]:
    if len(chars) > MAX_PAGE_CHARS:
        raise ValueError("Native character limit exceeded")
    if not chars:
        return []
    sizes = Counter(round(float(c["size"]), 1) for c in chars if c["text"].strip())
    body_size = sizes.most_common(1)[0][0] if sizes else 12.0
    lines: list[list[dict[str, Any]]] = []
    for char in sorted(chars, key=lambda c: (round(float(c["top"]) / 3), float(c["x0"]))):
        if not lines or abs(float(char["top"]) - float(lines[-1][0]["top"])) > max(
            2.0, body_size * 0.3
        ):
            lines.append([char])
        else:
            lines[-1].append(char)
    blocks: list[Block] = []
    for line in lines:
        line.sort(key=lambda c: float(c["x0"]))
        text = ""
        spans: list[Span] = []
        previous: dict[str, Any] | None = None
        for char in line:
            if (
                previous
                and float(char["x0"]) - float(previous["x1"]) > body_size * 0.2
                and not text.endswith(" ")
                and not char["text"].startswith(" ")
            ):
                text += " "
            start = len(text)
            text += str(char["text"])
            font = str(char.get("fontname", "")).casefold()
            if not synthetic and start < len(text):
                if "italic" in font or "oblique" in font:
                    spans.append(Span(start=start, end=len(text), kind="em"))
                if "bold" in font:
                    spans.append(Span(start=start, end=len(text), kind="strong"))
            previous = char
        if not text.strip():
            continue
        size = sum(float(c["size"]) for c in line) / len(line)
        left, top = min(float(c["x0"]) for c in line), min(float(c["top"]) for c in line)
        right, bottom = max(float(c["x1"]) for c in line), max(float(c["bottom"]) for c in line)
        heading = size > body_size * 1.22
        center = abs((left + right) / 2 - width / 2) < body_size and right - left < width * 0.8
        block = Block(
            id=f"p{page:04d}-b{len(blocks) + 1:04d}",
            kind="heading" if heading else "paragraph",
            text=text,
            text_sha256=digest_text(text),
            spans=spans,
            evidence=[
                Evidence(
                    page=page,
                    method="native",
                    bbox=(left, top, right, bottom),
                    artifact_sha256=source_hash,
                )
            ],
            style=Style(
                observed=["size", "align"],
                size=max(0.5, min(3.0, size / body_size)),
                align="center" if center else "start",
            ),
        )
        # Native line segmentation is retained deliberately: paragraph joins need validated layout.
        blocks.append(block)
    return blocks


def _visible_crop_objects(
    objects: list[dict[str, Any]],
    crop: tuple[float, float, float, float],
    pdf_origin: tuple[float, float],
    *,
    characters: bool = False,
) -> tuple[list[dict[str, Any]], int]:
    """Translate visible unrotated page observations into CropBox-local coordinates.

    pdfplumber's top/bottom are global top-left coordinates; renderer crops are local.
    Glyphs crossing the edge cannot be safely transcribed in full, so require review.
    """
    left, top, right, bottom = crop
    height = bottom - top
    visible: list[dict[str, Any]] = []
    excluded = 0
    for obj in objects:
        x0, y0, x1, y1 = (float(obj[k]) for k in ("x0", "top", "x1", "bottom"))
        if not all(math.isfinite(v) for v in (x0, y0, x1, y1)):
            raise ValueError("Nonfinite source geometry requires review")
        if characters:
            intersects = x0 < right and x1 > left and y0 < bottom and y1 > top
        else:
            # Zero-height/width vector lines can still be meaningful visible content.
            intersects = x0 <= right and x1 >= left and y0 <= bottom and y1 >= top
        if not intersects:
            excluded += 1
            continue
        if characters and not (left <= x0 < x1 <= right and top <= y0 < y1 <= bottom):
            raise ValueError("Partially clipped native glyph requires source review")
        result = dict(obj)
        result.update(
            x0=max(left, x0) - left,
            x1=min(right, x1) - left,
            top=max(top, y0) - top,
            bottom=min(bottom, y1) - top,
        )
        result["width"] = result["x1"] - result["x0"]
        result["height"] = result["bottom"] - result["top"]
        result["y0"] = height - result["bottom"]
        result["y1"] = height - result["top"]
        result.pop("doctop", None)  # Original document coordinates aren't local coordinates.
        matrix = result.get("matrix")
        if isinstance(matrix, (list, tuple)) and len(matrix) == 6:
            result["matrix"] = (
                *matrix[:4],
                float(matrix[4]) - pdf_origin[0],
                float(matrix[5]) - pdf_origin[1],
            )
        visible.append(result)
    return visible, excluded


def extract_native(path: Path, asset_root: Path) -> Book:
    import pdfplumber

    inspection = inspect_pdf(path)
    if any(a["disposition"] in {"visible", "personal"} for a in inspection["annotations"]):
        raise ValueError("PDF_ANNOTATIONS_REQUIRE_V2_RECONSTRUCTION")
    _qualify_native_graphics(path)
    source_hash = inspection["source_sha256"]
    producer = inspection["metadata"].get("Producer", "")
    synthetic = bool(re.search(r"ocr|clearscan|paper capture", producer, re.I))
    pages: list[Page] = []
    assets: dict[str, Asset] = {}
    issues = [
        Issue(
            code="native_layout_requires_review",
            message="Native lines, order, styles and paragraph segmentation require source review.",
        )
    ]
    with (
        tempfile.TemporaryDirectory(prefix="ava-pdf-render-") as temporary,
        pdfplumber.open(path) as pdf,
    ):
        cache: dict[int, Path] = {}
        for index, source_page in enumerate(pdf.pages, 1):
            bounds = source_page.cropbox
            crop = (float(bounds[0]), float(bounds[1]), float(bounds[2]), float(bounds[3]))
            width, height = crop[2] - crop[0], crop[3] - crop[1]
            pdf_crop = inspection["pages"][index - 1]["cropbox"]
            origin = (float(pdf_crop[0]), float(pdf_crop[1]))
            chars, outside_chars = _visible_crop_objects(
                source_page.chars, crop, origin, characters=True
            )
            rects, _ = _visible_crop_objects(source_page.rects, crop, origin)
            curves, _ = _visible_crop_objects(source_page.curves, crop, origin)
            lines, _ = _visible_crop_objects(source_page.lines, crop, origin)
            images, _ = _visible_crop_objects(source_page.images, crop, origin)
            page_issues: list[Issue] = []
            if outside_chars:
                page_issues.append(
                    Issue(
                        code="outside_crop_text_excluded",
                        message=f"{outside_chars} outside glyphs excluded from visible content.",
                        severity="info",
                        page=index,
                    )
                )
            vector_count = len(lines) + len(curves) + len(rects)
            if vector_count:
                page_issues.append(
                    Issue(
                        code="unsupported_vector_inventory",
                        message=f"{vector_count} vector occurrences require classification.",
                        page=index,
                    )
                )
            # Native text under solid drawing/image coverage cannot be silently exported.
            opaque = [r for r in rects + curves if r.get("fill")]
            if any(
                r["x0"] < c["x1"]
                and r["x1"] > c["x0"]
                and r["top"] < c["bottom"]
                and r["bottom"] > c["top"]
                for r in opaque
                for c in chars
            ):
                raise ValueError(
                    f"Page {index} has text under an opaque rectangle; safe-source review required"
                )
            for char in chars:
                color = char.get("non_stroking_color")
                components = color if isinstance(color, (tuple, list)) else [color]
                if components and all(isinstance(v, (float, int)) for v in components):
                    white = (
                        char.get("ncs") in {"DeviceGray", "DeviceRGB"}
                        and all(float(v) >= 0.98 for v in components if v is not None)
                    ) or (
                        char.get("ncs") == "DeviceCMYK"
                        and all(float(v) <= 0.02 for v in components if v is not None)
                    )
                    if white:
                        raise ValueError(f"Page {index} has white text requiring visibility review")
                if not (
                    0 <= char["x0"] < char["x1"] <= width
                    and 0 <= char["top"] < char["bottom"] <= height
                ):
                    raise ValueError(
                        f"Page {index} has clipped/off-page native text; review required"
                    )
            blocks = _text_blocks(chars, index, width, height, source_hash, synthetic)
            if synthetic:
                page_issues.append(
                    Issue(
                        code="synthetic_font_evidence",
                        message="Prior OCR: candidate text; original font/style unknown.",
                        page=index,
                    )
                )
            route: Literal["native", "needs_ocr"] = "native" if blocks else "needs_ocr"
            if any("\ufffd" in b.text or "(cid:" in b.text for b in blocks):
                route = "needs_ocr"
                page_issues.append(
                    Issue(
                        code="invalid_unicode_mapping",
                        message="Native glyph mapping requires visual recognition.",
                        page=index,
                    )
                )
            for occurrence in images:
                if occurrence.get("imagemask"):
                    page_issues.append(
                        Issue(
                            code="unsupported_mask_inventory",
                            message="Stencil evidence retained; illustration role unknown.",
                            severity="review",
                            page=index,
                        )
                    )
                    continue
                x0, top, x1, bottom = (float(occurrence[k]) for k in ("x0", "top", "x1", "bottom"))
                box = (
                    max(0.0, x0 / width),
                    max(0.0, top / height),
                    min(1.0, x1 / width),
                    min(1.0, bottom / height),
                )
                if box[0] >= box[2] or box[1] >= box[3]:
                    continue
                if (box[2] - box[0]) * (box[3] - box[1]) > 0.7:
                    route = "needs_ocr"
                    page_issues.append(
                        Issue(
                            code="page_image_requires_recognition",
                            message="Page image needs recognition before figure classification.",
                            page=index,
                        )
                    )
                    # An existing hidden OCR layer is not automatically safe visible content.
                    if chars:
                        raise ValueError(
                            f"Page {index}: text under page image requires visible-text review"
                        )
                    continue
                if any(
                    x0 < c["x1"] and x1 > c["x0"] and top < c["bottom"] and bottom > c["top"]
                    for c in chars
                ):
                    raise ValueError(
                        f"Page {index} image overlaps native text; safe composition review required"
                    )
                if index not in cache:
                    cache[index] = Path(temporary) / f"{index:04d}.png"
                    render_page(path, index, cache[index])
                asset = crop_asset(
                    path, index, box, asset_root, "Source image; description not verified", cache
                )
                assets.setdefault(asset.id, asset)
                blocks.append(
                    Block(
                        id=f"p{index:04d}-image{len(blocks) + 1:04d}",
                        kind="figure",
                        asset_id=asset.id,
                        evidence=asset.evidence,
                    )
                )
                page_issues.append(
                    Issue(
                        code="figure_role_requires_review",
                        message="Raster captured; caption, order and role need review.",
                        page=index,
                    )
                )
            if not blocks:
                page_issues.append(
                    Issue(
                        code="recognition_required",
                        message="No native content; blankness is not established.",
                        page=index,
                    )
                )
            pages.append(
                Page(
                    number=index,
                    label=str(inspection["page_labels"][index - 1]),
                    width=width,
                    height=height,
                    route=route,
                    blocks=blocks,
                    issues=page_issues,
                )
            )
            source_page.close()
    if not any(p.blocks for p in pages):
        raise ValueError(
            "PDF has no native content; provide a configured OCR adapter or reviewed extraction"
        )
    chapter_candidates = inspection["outlines"]
    if not chapter_candidates:
        chapter_candidates = [
            {"title": b.text, "page_index": p.number}
            for p in pages
            for b in p.blocks
            if b.kind == "heading"
        ]
        issues.append(
            Issue(
                code="derived_heading_navigation",
                message="Navigation uses measured headings; chapter roles need review.",
            )
        )
    chapters, chapter_issues = chapters_from_plan(pages, chapter_candidates)
    claims = [
        Claim(field=key.lower(), value=value, status="candidate")
        for key, value in inspection["metadata"].items()
        if key in {"Title", "Author", "Subject", "Keywords", "Creator", "Producer"} and value
    ]
    return Book(
        source_sha256=source_hash,
        page_count=len(pages),
        pages=pages,
        chapters=chapters,
        metadata=claims,
        assets=list(assets.values()),
        issues=issues + chapter_issues,
    )
