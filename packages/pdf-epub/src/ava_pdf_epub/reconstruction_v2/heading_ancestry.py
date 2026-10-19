"""Strict chapter-local ancestry, independent of provisional OCR review routing."""


class MixedHeadingReviewRequired(ValueError):
    """Native size cannot establish ancestry through an unmeasured OCR heading."""


def section_level(
    size: float | None, ancestors: list[float | None], declared: int | None = None
) -> int:
    """Infer only observed chapter-local ancestry; later large siblings cannot skip an H2."""
    if declared is not None:
        if declared < 2 or declared > len(ancestors) + 2:
            raise ValueError("Declared heading skips an unobserved parent")
        del ancestors[declared - 2 :]
    else:
        if size is None:
            raise ValueError("A heading without source size requires a declared level")
        while ancestors:
            previous = ancestors[-1]
            if previous is None:
                raise MixedHeadingReviewRequired(
                    "Mixed heading hierarchy requires source corroboration"
                )
            if size < previous - 0.5:
                break
            ancestors.pop()
    level = len(ancestors) + 2
    if level > 6:
        raise ValueError("Native heading hierarchy exceeds the supported depth")
    ancestors.append(size)
    return level
