"""Source-backed boundaries cannot discard an incoming fragment's base typography."""

from .continuation_boundary import JOIN_STYLE
from .segments import Segment


def refined_boundaries(
    segments: list[Segment], edges: dict[tuple[str, str], bool]
) -> list[Segment]:
    result = list(segments)
    adjacent = {(a.id, b.id) for a, b in zip(result, result[1:], strict=False)}
    if not set(edges).issubset(adjacent):
        raise ValueError("Refined join is not adjacent in source reading order")
    for index in range(1, len(result)):
        previous, current = result[index - 1 : index + 1]
        key = (previous.id, current.id)
        if key not in edges:
            continue
        if previous.kind != "paragraph" or current.kind != "paragraph":
            raise ValueError("Refined join is not prose")
        if edges[key]:
            if (
                previous.style is None
                or current.style is None
                or (
                    previous.style.model_dump(include=JOIN_STYLE)
                    != current.style.model_dump(include=JOIN_STYLE)
                )
            ):
                raise ValueError("Refined join would discard fragment typography")
        else:
            result[index - 1] = previous.model_copy(update={"continues_to_next": False})
            result[index] = current.model_copy(update={"continues_from_previous": False})
    return result
