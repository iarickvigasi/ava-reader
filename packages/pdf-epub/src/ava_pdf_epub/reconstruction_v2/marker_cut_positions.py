"""Project raw link destinations and origins through an explicitly removed printed marker."""

from .assembly_state import AssemblyState
from .internal_links import _resolve
from .layout_hyphen_offsets import layout_hyphen_range


def marker_cut_positions(ident: str, cut: int, length: int, state: AssemblyState) -> None:
    def shift(owner: str, offset: int) -> int:
        if owner != ident:
            return offset
        if not 0 <= offset <= length:
            raise ValueError("Printed marker destination is outside original owner")
        # A destination in the structural label opens its retained body.
        return max(0, offset - cut)

    targets = []
    for origin, first, last, target, at in state.internal_targets:
        owner, origin_offset = _resolve(origin, state)
        destination, target_offset = _resolve(target, state)
        first, last = first + origin_offset, last + origin_offset
        if owner == ident:
            first, last = layout_hyphen_range(first, last, [(0, cut)], length, referenced=True)
        targets.append((owner, first, last, destination, shift(destination, at + target_offset)))
    aliases = {}
    for alias in state.aliases:
        owner, at = _resolve(alias, state)
        aliases[alias] = (owner, shift(owner, at))
    state.internal_targets, state.aliases = targets, aliases
