"""Bounded local word geometry only for unresolved source annotations."""

import hashlib
import math
import os
import selectors
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageChops

from ..annotation_view import annotation_view
from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId, checked_profile
from ..contracts.source import Box
from ..extract import render_page
from .annotation_word_visibility import source_visible_words
from .annotation_words import ERROR, MAX_BYTES, AnnotationRasterFrame, AnnotationWord, parse_words
from .geometry import overlap
from .observations import NativeLine, PageObservation

TIMEOUT_SECONDS = 20
MAX_IMAGE_BYTES = 32 * 1024 * 1024


def recognize_annotation_words(
    page: PageObservation,
    scratch: Path,
    source: Path | None = None,
    profile_id: ProfileId = LEGACY_PROFILE,
) -> list[AnnotationWord]:
    try:
        checked_profile(profile_id)
        return _recognize_annotation_words(page, scratch, source, profile_id)
    except (OSError, ValueError):
        raise ValueError(ERROR) from None


def _recognize_annotation_words(
    page: PageObservation, scratch: Path, source: Path | None, profile_id: ProfileId
) -> list[AnnotationWord]:
    image = (scratch / page.render_path).resolve()
    if not image.is_relative_to(scratch.resolve()) or not image.is_file():
        raise ValueError(ERROR)
    if image.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError(ERROR)
    if hashlib.sha256(image.read_bytes()).hexdigest() != page.render_sha256:
        raise ValueError(ERROR)
    with Image.open(image) as raw:
        original = raw.convert("RGB")
    # Strip only inline annotation objects, preserving authorial textbox/other appearances.
    # Redaction/action admission still runs before producing this private rendering view.
    with tempfile.TemporaryDirectory(prefix="ava-annotation-words-") as directory:
        temporary = Path(directory)
        if source is not None:
            view_pdf = annotation_view(source, scratch, exclude_inline=True)
            clean_render = temporary / "without-inline.png"
            render_page(view_pdf, page.number, clean_render)
            image = clean_render
        with Image.open(image) as rendered:
            if rendered.size != (page.render_width, page.render_height):
                raise ValueError(ERROR)
            clean = rendered.convert("RGB")
            view = annotation_word_view(clean, page)
        path = temporary / "words.png"
        # PNG re-encoding otherwise drops physical resolution. Automatic OCR
        # can then omit a ruled table despite unchanged, clearly visible pixels.
        view.save(path, dpi=(view.width / page.width_pt * 72, view.height / page.height_pt * 72))
        output = _run_ocr(path, "eng+ukr" if profile_id == BILINGUAL_PROFILE else "eng")
    return source_visible_words(page, parse_words(output, page), original, clean)


def recognize_native_line_words(
    page: PageObservation,
    line: NativeLine,
    caller: Box,
    scratch: Path,
    profile_id: ProfileId,
) -> list[AnnotationWord]:
    """Corroborate a complete isolated native line in unchanged saved source pixels."""
    try:
        checked_profile(profile_id)
        if page.rotation != 0 or page.required_regions or page.risks or not line.glyphs:
            raise ValueError(ERROR)
        envelope = [line.box, caller, *[g.box for g in line.glyphs]]
        if any(not b.within(page.width_pt, page.height_pt) for b in envelope):
            raise ValueError(ERROR)
        w, h = page.render_width, page.render_height
        left = max(0, math.floor(min(b.x0 for b in envelope) * w / page.width_pt) - 1)
        top = max(0, math.floor(min(b.y0 for b in envelope) * h / page.height_pt) - 1)
        right = min(w, math.ceil(max(b.x1 for b in envelope) * w / page.width_pt) + 1)
        bottom = min(h, math.ceil(max(b.y1 for b in envelope) * h / page.height_pt) + 1)
        bounds = Box(
            coordinate_space="page_points_top_left",
            x0=left * page.width_pt / w,
            y0=top * page.height_pt / h,
            x1=right * page.width_pt / w,
            y1=bottom * page.height_pt / h,
        )
        if any(other.id != line.id and overlap(other.box, bounds) for other in page.lines) or any(
            overlap(graphic.box, bounds) for graphic in page.graphics
        ):
            raise ValueError(ERROR)
        image = (scratch / page.render_path).resolve()
        if not image.is_relative_to(scratch.resolve()) or not image.is_file():
            raise ValueError(ERROR)
        if (
            image.stat().st_size > MAX_IMAGE_BYTES
            or hashlib.sha256(image.read_bytes()).hexdigest() != page.render_sha256
        ):
            raise ValueError(ERROR)
        with Image.open(image) as raw:
            if raw.size != (w, h):
                raise ValueError(ERROR)
            original = raw.convert("RGB")
        try:
            with original.crop((left, top, right, bottom)) as crop:
                with tempfile.TemporaryDirectory(prefix="ava-native-line-words-") as directory:
                    path = Path(directory) / "words.png"
                    crop.save(path, dpi=(w / page.width_pt * 72, h / page.height_pt * 72))
                    payload = _run_ocr(
                        path, "eng+ukr" if profile_id == BILINGUAL_PROFILE else "eng"
                    )
                frame = AnnotationRasterFrame(page, left, top, right - left, bottom - top)
                words = source_visible_words(page, parse_words(payload, frame), original, original)
        finally:
            original.close()
        if hashlib.sha256(image.read_bytes()).hexdigest() != page.render_sha256:
            raise ValueError(ERROR)
        return words
    except (OSError, ValueError):
        raise ValueError(ERROR) from None


def annotation_word_view(rendered: Image.Image, page: PageObservation) -> Image.Image:
    """Remove corroborated annotation background color from an OCR-only view.

    A global luminance threshold would erase light/colored ink. Replacement is
    confined to declared highlight regions and near-exact fill pixels; original
    pixels still determine appearance and text color. Ambiguous text stays reviewable.
    """
    image = rendered.convert("RGB")
    for region in page.required_regions:
        if region.kind != "inline_style" or not region.style or not region.style.background_color:
            continue
        box = region.box
        bounds = (
            int(box.x0 / page.width_pt * image.width),
            int(box.y0 / page.height_pt * image.height),
            int(box.x1 / page.width_pt * image.width),
            int(box.y1 / page.height_pt * image.height),
        )
        if not box.within(page.width_pt, page.height_pt):
            raise ValueError(ERROR)
        crop = image.crop(bounds)
        if crop.width < 1 or crop.height < 1:
            raise ValueError(ERROR)
        color = region.style.background_color
        if color is None:
            raise ValueError(ERROR)
        rgb = tuple(int(color[index : index + 2], 16) for index in (1, 3, 5))
        channels = ImageChops.difference(crop, Image.new("RGB", crop.size, rgb)).split()
        distance = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
        mask = distance.point(lambda value: 255 if value <= 15 else 0)
        crop.paste((255, 255, 255), mask=mask)
        image.paste(crop, bounds)
    return image


def _run_ocr(image: Path, languages: str = "eng") -> bytes:
    if languages not in {"eng", "eng+ukr"}:
        raise ValueError(ERROR)
    process: subprocess.Popen[bytes] | None = None
    try:
        process = subprocess.Popen(
            [
                "/usr/bin/tesseract",
                str(image),
                "stdout",
                "--oem",
                "1",
                "-l",
                languages,
                "--psm",
                "3",
                "tsv",
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env={
                "LANG": "C.UTF-8",
                "OMP_THREAD_LIMIT": "1",
                "TESSDATA_PREFIX": "/usr/share/tesseract-ocr/5/tessdata",
            },
        )
        if process.stdout is None:
            raise ValueError(ERROR)
        deadline = time.monotonic() + TIMEOUT_SECONDS
        output = bytearray()
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not selector.select(remaining):
                    raise ValueError(ERROR)
                chunk = os.read(process.stdout.fileno(), 65536)
                if not chunk:
                    break
                if len(output) + len(chunk) > MAX_BYTES:
                    raise ValueError(ERROR)
                output.extend(chunk)
        remaining = deadline - time.monotonic()
        if remaining <= 0 or process.wait(timeout=remaining) != 0:
            raise ValueError(ERROR)
        return bytes(output)
    except (OSError, subprocess.SubprocessError, ValueError):
        # Neither native stderr nor recognized book words enter a public error.
        raise ValueError(ERROR) from None
    finally:
        if process is not None:
            if process.poll() is None:
                process.kill()
            process.wait()
            if process.stdout is not None:
                process.stdout.close()
