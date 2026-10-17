"""Bounded common-scale source-column crops; labels stay outside source pixels."""

import base64
import hashlib
import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ..contracts.source import Box
from .page_checkpoints import PreparedPageMap
from .recognition_contract import RecognitionImage
from .refinement_sheet_bounds import LABEL_HEIGHT, SLOT_WIDTH, sheet_row_heights
from .segments import Segment
from .source_feature_contract import SourceFeatureRequest
from .source_feature_geometry import feature_crop, feature_dimensions
from .source_feature_task_contract import SourceFeatureCrop


def feature_pieces(
    requests: list[SourceFeatureRequest], segments: dict[str, Segment], pages: PreparedPageMap
) -> list[tuple[SourceFeatureRequest, Segment, Box]]:
    return [
        (q, segments[i], feature_crop(segments[i], q.column_box, pages[q.page]))
        for q in requests
        for i in [q.node_id, *q.reference_ids]
    ]


def feature_sheet_fits(
    requests: list[SourceFeatureRequest], segments: dict[str, Segment], pages: PreparedPageMap
) -> bool:
    dims = [feature_dimensions(box) for _, _, box in feature_pieces(requests, segments, pages)]
    return (
        bool(dims)
        and len(dims) <= 48
        and all(w <= SLOT_WIDTH and h <= 1000 for w, h in dims)
        and sum(sheet_row_heights([h for _, h in dims])) <= 2048
    )


def source_feature_sheet(
    requests: list[SourceFeatureRequest],
    segments: dict[str, Segment],
    pages: PreparedPageMap,
    scratch: Path,
) -> tuple[list[SourceFeatureCrop], RecognitionImage]:
    if not feature_sheet_fits(requests, segments, pages):
        raise ValueError("Source feature context cannot fit at readable physical scale")
    pieces = feature_pieces(requests, segments, pages)
    heights = sheet_row_heights([feature_dimensions(box)[1] for _, _, box in pieces])
    sheet = Image.new("RGB", (SLOT_WIDTH * 2, sum(heights)), "white")
    draw, crops, y = ImageDraw.Draw(sheet), [], 0
    for index, (request, segment, box) in enumerate(pieces):
        page = pages[segment.page].observation
        with Image.open(scratch / page.render_path) as opened:
            sx, sy = opened.width / page.width_pt, opened.height / page.height_pt
            pixels = opened.convert("RGB").crop(
                (
                    math.floor(box.x0 * sx),
                    math.floor(box.y0 * sy),
                    math.ceil(box.x1 * sx),
                    math.ceil(box.y1 * sy),
                )
            )
            pixels = pixels.resize(feature_dimensions(box), Image.Resampling.LANCZOS)
        key = hashlib.sha256((request.node_id + ":" + segment.id).encode()).hexdigest()[:24]
        ident, x = "feature-crop-" + key, (index % 2) * SLOT_WIDTH
        draw.text((x + 4, y + 4), ident, fill="black", font=ImageFont.load_default(size=18))
        sheet.paste(pixels, (x, y + LABEL_HEIGHT))
        crops.append(
            SourceFeatureCrop(
                id=ident,
                part="context",
                request_node_id=request.node_id,
                node_id=segment.id,
                page=segment.page,
                source_box=box,
                render_sha256=page.render_sha256,
                image_box=[x, y + LABEL_HEIGHT, x + pixels.width, y + LABEL_HEIGHT + pixels.height],
            )
        )
        if index % 2:
            y += heights[index // 2]
    output = io.BytesIO()
    sheet.save(output, format="PNG")
    data = output.getvalue()
    if len(data) > 4 * 1024**2:
        raise ValueError("Source feature image exceeds unchanged byte bound")
    return crops, RecognitionImage(
        media_type="image/png",
        width=sheet.width,
        height=sheet.height,
        byte_length=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        base64=base64.b64encode(data).decode(),
    )
