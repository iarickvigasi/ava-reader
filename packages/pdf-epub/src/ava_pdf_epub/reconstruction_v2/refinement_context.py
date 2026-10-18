"""Immutable construction inputs shared by bounded source-comparison groups."""

from dataclasses import dataclass
from pathlib import Path

from ..contracts.profiles import ProfileId
from .page_checkpoints import PreparedPageMap
from .segments import Segment


@dataclass(frozen=True)
class RefinementContext:
    source_sha256: str
    observation_sha256: str
    profile_id: ProfileId
    scratch: Path
    segments: dict[str, Segment]
    pages: PreparedPageMap
    tail_ids: set[str]
    structure_prompt: str
    alignment_origins: dict[str, str]
    continuation_policy: str | None
    projected_nodes: bool
