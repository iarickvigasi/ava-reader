"""Private literal-URI evidence is a terminal subspan witness, never a whole-owner map."""

from dataclasses import dataclass

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .observations import Glyph, NativeLine
from .segments import Segment

PeerIdentity = tuple[str, str, str, tuple[str, ...]]


@dataclass(frozen=True)
class OriginalUriGroup:
    raw_uri: str
    current_index: int
    boxes: tuple[tuple[int, Box], ...]


@dataclass(frozen=True)
class UriSourcePart:
    annotation_index: int
    line: NativeLine
    values: tuple[tuple[int, Glyph], ...]
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class UriOwnerSpan:
    owner: Segment
    start: int
    end: int
    ranges: tuple[tuple[str, int, int], ...]


@dataclass(frozen=True)
class PendingUriLink:
    reader_identity: int
    checkpoint_sha256: str
    target: NavigationTarget
    group: OriginalUriGroup
    caller: Box
    owner_id: str
    owner_identity: str
    peers: tuple[PeerIdentity, ...]
    full_range: tuple[int, int]
    ranges: tuple[tuple[str, int, int], ...]
