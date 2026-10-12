"""Marker typography uses existing styles, with no block layout or resource declarations."""

from .styles import Style

MARKER_STYLE_FIELDS = ("family", "bold", "italic", "small_caps", "relative_size", "color")


def validate_marker_style(style: Style) -> None:
    if any(
        value is not None and key not in {"id", *MARKER_STYLE_FIELDS}
        for key, value in style.model_dump().items()
    ):
        raise ValueError("List marker style contains unsupported presentation")
