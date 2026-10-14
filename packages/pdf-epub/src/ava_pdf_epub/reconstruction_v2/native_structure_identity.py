"""Bind native text, source regions and image bytes before any provider spending."""

import base64
import io
import json
from typing import TYPE_CHECKING, Any

from PIL import Image

from ..contracts.common import text_digest, unique
from ..contracts.source import SourcePage

if TYPE_CHECKING:
    from .native_structure_versions import AnyNativeStructureTask


def native_structure_identifier(values: dict[str, Any]) -> str:
    identity = dict(values)
    identity.pop("task_id", None)
    identity["image"] = {k: v for k, v in identity["image"].items() if k != "base64"}
    return "native-structure-" + text_digest(
        json.dumps(identity, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    )


def validate_native_structure_task(task: "AnyNativeStructureTask") -> None:
    image = base64.b64decode(task.image.base64, validate=True)
    if len(image) != task.image.byte_length or text_digest_bytes(image) != task.image.sha256:
        raise ValueError("Native structure image identity differs")
    with Image.open(io.BytesIO(image)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(image)) as opened:
        if (
            opened.size != (task.image.width, task.image.height)
            or opened.width * opened.height > 20000000
            or getattr(opened, "n_frames", 1) != 1
            or opened.format != {"image/png": "PNG", "image/jpeg": "JPEG"}[task.image.media_type]
            or opened.getexif().get(274, 1) != 1
        ):
            raise ValueError("Native structure image descriptor differs")
        opened.load()
    if task.task_id != native_structure_identifier(task.model_dump(mode="json")):
        raise ValueError("Native structure task identity differs")
    unique([line.id for line in task.lines], "native structure line")
    unique([span.id for line in task.lines for span in line.spans], "native structure span")
    unique([a.id for a in task.artifacts], "native structure artifact")
    unique([b.candidate_id for b in task.boundaries], "native structure boundary")
    unique([c.span_id for c in task.eligible_callouts], "native structure eligible callout")
    SourcePage(
        number=task.page_number,
        width_pt=task.page_width_pt,
        height_pt=task.page_height_pt,
        original_rotation=0,
        regions=[r.source for r in task.regions],
    )
    lines, owners = {line.id: line for line in task.lines}, {}
    artifacts = {a.id for a in task.artifacts}
    artifact_owners = []
    for region in task.regions:
        if region.artifact_id is not None:
            artifact_owners.append(region.artifact_id)
        local = []
        for ident in region.line_ids:
            if ident not in lines or ident in owners:
                raise ValueError("Native structure line region ownership differs")
            line, box = lines[ident], region.source.box
            if not (
                line.box.coordinate_space == box.coordinate_space == "page_points_top_left"
                and box.x0 <= line.box.x0 < line.box.x1 <= box.x1
                and box.y0 <= line.box.y0 < line.box.y1 <= box.y1
            ):
                raise ValueError("Native structure line is outside its source region")
            owners[ident] = region.source.id
            local.append((line.box.y0, line.box.x0))
        if local != sorted(local):
            raise ValueError("Native structure source line order differs")
    if set(owners) != set(lines) or set(artifact_owners) != artifacts:
        raise ValueError("Native structure source coverage differs")
    unique(artifact_owners, "native structure artifact owner")
    if artifacts.intersection(r.source.id for r in task.regions):
        raise ValueError("Native structure artifact and region identities collide")
    for boundary in task.boundaries:
        if boundary.left_line_id not in owners or boundary.right_line_id not in owners:
            raise ValueError("Native structure boundary has a foreign source line")
    spans = {span.id: (line, span) for line in task.lines for span in line.spans}
    for callout in task.eligible_callouts:
        source = spans.get(callout.span_id)
        if source is None:
            raise ValueError("Native structure callout has a foreign source span")
        line, span = source
        if (
            line.id != callout.line_id
            or span.style is None
            or span.style.vertical_align != "super"
            or line.text[span.start : span.end] != callout.exact_text
            or not (
                callout.box.coordinate_space == "page_points_top_left"
                and line.box.x0 <= callout.box.x0 < callout.box.x1 <= line.box.x1
                and line.box.y0 <= callout.box.y0 < callout.box.y1 <= line.box.y1
            )
        ):
            raise ValueError("Native structure callout differs from its measured source span")


def text_digest_bytes(value: bytes) -> str:
    import hashlib

    return hashlib.sha256(value).hexdigest()
