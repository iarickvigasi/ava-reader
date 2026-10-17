"""Select finite same/adjacent-page, matching-column native paragraph witnesses."""

from statistics import median

from .native_indent_peers import GEOMETRY_TOLERANCE_PT, IndentPeer
from .observations import PageObservation

MAX_LOCAL_PEERS = 256


def native_indent_reference(
    page: PageObservation,
    column: int,
    band: int,
    layouts: dict[int, tuple[PageObservation, bool]],
    peers: list[IndentPeer],
    signature: tuple[str, float],
    first: float,
    literal: bool,
) -> tuple[float, float | None] | None:
    two_columns = layouts[page.number][1]
    selected = []
    for peer in peers:
        other, other_two_columns = layouts[peer.page]
        if (
            abs(peer.page - page.number) > 1
            or peer.column != column
            or two_columns != other_two_columns
            or (page.width_pt, page.height_pt, page.rotation)
            != (other.width_pt, other.height_pt, other.rotation)
            or (two_columns and (peer.page != page.number or peer.band != band))
            or (
                not literal
                and (peer.typeface != signature[0] or abs(peer.size - signature[1]) > 0.01)
            )
        ):
            continue
        selected.append(peer)
    if not 2 <= len(selected) <= MAX_LOCAL_PEERS:
        return None
    margins = [peer.body for peer in selected]
    margin = median(margins)
    if any(abs(value - margin) > GEOMETRY_TOLERANCE_PT for value in margins):
        return None
    if literal:
        cohorts = {(peer.typeface, peer.size) for peer in selected}
        if not any(
            sum((p.typeface, p.size) == cohort for p in selected) >= 2 for cohort in cohorts
        ):
            return None
        return margin, None
    matching = [peer for peer in selected if abs(peer.first - first) <= GEOMETRY_TOLERANCE_PT]
    if len(matching) < 2:
        return None
    displacement = first - margin
    if any(abs((p.first - p.body) - displacement) > GEOMETRY_TOLERANCE_PT for p in matching):
        return None
    return margin, displacement
