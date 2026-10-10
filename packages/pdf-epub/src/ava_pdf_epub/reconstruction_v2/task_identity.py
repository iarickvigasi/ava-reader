"""Authenticate response/task content independently of generation, fence or provider key."""

import base64
import hashlib
import io
import json
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from .recognition_contract import RecognitionTask


def task_identifier(value: dict[str, object]) -> str:
    identity = dict(value)
    identity.pop("task_id", None)
    image = identity["image"]
    if not isinstance(image, dict):
        raise ValueError("Invalid image descriptor")
    identity["image"] = {k: v for k, v in image.items() if k != "base64"}
    raw = json.dumps(identity, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "recognize-" + hashlib.sha256(raw.encode()).hexdigest()


def validate_task(task: "RecognitionTask") -> None:
    image = base64.b64decode(task.image.base64, validate=True)
    if (
        len(image) != task.image.byte_length
        or hashlib.sha256(image).hexdigest() != task.image.sha256
    ):
        raise ValueError("Recognition image bytes do not match the declared identity")
    if hashlib.sha256(task.native_evidence.encode()).hexdigest() != task.native_evidence_sha256:
        raise ValueError("Recognition native evidence digest mismatch")
    if task.task_id != task_identifier(task.model_dump(mode="json")):
        raise ValueError("Recognition task identity mismatch")
    if not task.region_box.within(task.page_width_pt, task.page_height_pt):
        raise ValueError("Recognition region exceeds source page")
    with Image.open(io.BytesIO(image)) as opened:
        opened.verify()
    with Image.open(io.BytesIO(image)) as opened:
        if opened.size != (task.image.width, task.image.height):
            raise ValueError("Recognition image dimensions mismatch")
        if opened.width * opened.height > 20000000 or getattr(opened, "n_frames", 1) != 1:
            raise ValueError("Recognition image bound exceeded")
        if opened.format != {"image/png": "PNG", "image/jpeg": "JPEG"}[task.image.media_type]:
            raise ValueError("Recognition image format mismatch")
        if opened.getexif().get(274, 1) != 1:
            raise ValueError("Recognition image has unapplied EXIF orientation")
        opened.load()
