"""Private content-addressed provenance, never a reusable link acceptance receipt."""

import hashlib
import json
import os
from pathlib import Path

from ..contracts.common import document_digest
from ..contracts.private_files import snapshot
from .prepared_types import AnyPreparedPage
from .recognition_contract import RecognitionTask
from .toc_projection_types import TocOwnerProjection


def toc_projection_receipt(
    scratch: Path,
    checkpoint: AnyPreparedPage,
    task: RecognitionTask,
    projections: list[TocOwnerProjection],
    policy: str | None,
) -> str:
    value = dict(
        schema_version="ava-source-toc-geometry-1",
        source_sha256=checkpoint.source_sha256,
        observation_sha256=document_digest(checkpoint.observation),
        task_sha256=document_digest(task),
        profile_id=checkpoint.profile_id,
        source_layout_policy="ava-native-layout-1",
        source_continuation_policy=policy,
        owners=[
            dict(
                id=p.raw.id,
                raw_sha256=document_digest(p.raw),
                projected_sha256=document_digest(p.owner),
                raw_box=p.raw.box.model_dump(),
                source_box=p.owner.box.model_dump(),
                annotation_number=p.source.annotation_number,
                target_page=p.source.target_page,
                caller=p.source.caller.model_dump() if p.source.caller else None,
                glyphs=[(line.id, i) for line, v in p.source.fragments for i, _ in v],
            )
            for p in projections
        ],
    )
    wire = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    if len(wire) > 2 * 1024 * 1024:
        raise ValueError("Source TOC geometry provenance exceeds bound")
    digest = hashlib.sha256(wire).hexdigest()
    folder = scratch / "toc-projections"
    folder.mkdir(mode=0o700, exist_ok=True)
    name = digest + ".json"
    directory = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        try:
            descriptor = os.open(
                name,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                0o600,
                dir_fd=directory,
            )
        except FileExistsError:
            if snapshot(scratch, f"toc-projections/{name}", len(wire)) != wire:
                raise ValueError("Source TOC geometry evidence collision") from None
        else:
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(wire)
    finally:
        os.close(directory)
    return digest
