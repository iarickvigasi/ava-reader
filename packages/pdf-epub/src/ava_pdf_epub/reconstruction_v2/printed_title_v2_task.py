"""One finite title comparison reuses hash-checked original source renders."""

import base64
import hashlib
import io
import math
from collections.abc import Mapping
from pathlib import Path
from typing import Literal, cast

from PIL import Image, ImageDraw, ImageFont

from ..contracts.common import text_digest
from ..contracts.private_files import snapshot
from .prepared_types import AnyPreparedPage
from .printed_title_v2_candidates import frontmatter_title_candidates
from .printed_title_v2_contract import (
    FrontmatterTitleCrop,
    FrontmatterTitleNode,
    FrontmatterTitlePage,
    FrontmatterTitleTask,
)
from .printed_title_v2_geometry import LABEL_HEIGHT, frontmatter_title_geometry
from .recognition_contract import RecognitionImage
from .refinement_identity import refinement_identifier
from .segments import Segment


def frontmatter_title_task(
    segments: list[Segment],
    pages: Mapping[int, AnyPreparedPage],
    scratch: Path,
    source_sha: str,
    observation_sha: str,
) -> FrontmatterTitleTask | None:
    selected = frontmatter_title_candidates(segments)
    if not selected:
        return None
    nodes = []
    for segment, primary in selected:
        page = pages[segment.page].observation
        nodes.append(
            FrontmatterTitleNode(
                id=segment.id,
                page=segment.page,
                text=segment.text,
                text_sha256=text_digest(segment.text),
                method=cast(Literal["native", "ocr"], segment.method),
                box=segment.box,
                page_width_pt=page.width_pt,
                page_height_pt=page.height_pt,
                render_sha256=page.render_sha256,
                primary_eligible=primary,
            )
        )
    contexts = [
        FrontmatterTitlePage(
            page=n,
            page_width_pt=pages[n].observation.width_pt,
            page_height_pt=pages[n].observation.height_pt,
            render_sha256=pages[n].observation.render_sha256,
        )
        for n in sorted({1, *(s.page for s, _ in selected)})
    ]
    pieces, width, height = frontmatter_title_geometry(nodes, contexts)
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    crops = []
    for context in contexts:
        page = pages[context.page].observation
        render_data = snapshot(scratch, page.render_path, 32 * 1024**2)
        if hashlib.sha256(render_data).hexdigest() != page.render_sha256:
            raise ValueError("Frontmatter title original source render is stale")
        with Image.open(io.BytesIO(render_data)) as opened:
            opened.load()
            if opened.size != (page.render_width, page.render_height):
                raise ValueError("Frontmatter title original render dimensions differ")
            sx, sy = opened.width / page.width_pt, opened.height / page.height_pt
            for ident, _part, _node, number, box, _digest, xy in pieces:
                if number != context.page:
                    continue
                x0, y0, x1, y1 = xy
                bitmap = opened.convert("RGB").crop(
                    (
                        math.floor(box.x0 * sx),
                        math.floor(box.y0 * sy),
                        math.ceil(box.x1 * sx),
                        math.ceil(box.y1 * sy),
                    )
                )
                bitmap = bitmap.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
                draw.text(
                    (x0 + 4, y0 - LABEL_HEIGHT + 4),
                    ident,
                    fill="black",
                    font=ImageFont.load_default(size=18),
                )
                sheet.paste(bitmap, (x0, y0))
    for ident, part, node, number, box, digest, xy in pieces:
        crops.append(
            FrontmatterTitleCrop(
                id=ident,
                part=part,
                node_id=node,
                page=number,
                source_box=box,
                render_sha256=digest,
                image_box=xy,
            )
        )
    buffer = io.BytesIO()
    sheet.save(buffer, format="PNG")
    data = buffer.getvalue()
    if len(data) > 4 * 1024**2:
        raise ValueError("Frontmatter title image byte bound exceeded")
    image = RecognitionImage(
        media_type="image/png",
        sha256=hashlib.sha256(data).hexdigest(),
        byte_length=len(data),
        width=width,
        height=height,
        base64=base64.b64encode(data).decode(),
    )
    first = pages[1]
    raw = dict(
        schema_version="ava-printed-title-task-2",
        source_sha256=source_sha,
        observation_sha256=observation_sha,
        source_page_count=first.source_page_count,
        profile_id=first.profile_id,
        prompt_version="ava-printed-title-2",
        response_schema_version="ava-printed-title-response-2",
        nodes=[n.model_dump(mode="json") for n in nodes],
        pages=[p.model_dump(mode="json") for p in contexts],
        pixels_per_point=2,
        crops=[c.model_dump(mode="json") for c in crops],
        image=image.model_dump(mode="json"),
    )
    raw["task_id"] = refinement_identifier(raw)
    return FrontmatterTitleTask.model_validate(raw)
