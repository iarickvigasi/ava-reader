"""Typography and applied links may change; source content and ownership may not."""

from .segments import Segment
from .source_context_identity import source_context_identity
from .uri_group_types import PeerIdentity


def uri_peer_identities(owners: list[Segment]) -> tuple[PeerIdentity, ...]:
    return tuple(
        sorted(
            (s.id, source_context_identity(s), s.method, tuple(s.native_line_ids)) for s in owners
        )
    )
