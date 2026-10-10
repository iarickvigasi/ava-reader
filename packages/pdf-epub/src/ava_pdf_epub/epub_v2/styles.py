"""Finite styles only; unknown produces no declaration and false/zero is explicit."""

from ..contracts.styles import Style
from .context import ident


def declarations(style: Style) -> str:
    values: list[tuple[str, str]] = []
    direct = {"family": "font-family", "align": "text-align", "vertical_align": "vertical-align"}
    for key, css in direct.items():
        value = getattr(style, key)
        if value is not None:
            values.append((css, value))
    for key, css, yes, no in [
        ("bold", "font-weight", "700", "400"),
        ("italic", "font-style", "italic", "normal"),
        ("small_caps", "font-variant", "small-caps", "normal"),
    ]:
        value = getattr(style, key)
        if value is not None:
            values.append((css, yes if value else no))
    for key, css in [
        ("relative_size", "font-size"),
        ("indent_em", "text-indent"),
        ("block_indent_em", "margin-inline-start"),
        ("space_before_em", "margin-top"),
        ("space_after_em", "margin-bottom"),
    ]:
        value = getattr(style, key)
        if value is not None:
            values.append((css, f"{value:g}em"))
    for key, css in [
        ("color", "color"),
        ("background_color", "background-color"),
        ("decoration_color", "text-decoration-color"),
    ]:
        value = getattr(style, key)
        if value is not None:
            values.append((css, value))
    if style.underline is not None or style.strike_through is not None:
        decoration = []
        if style.underline:
            decoration.append("underline")
        if style.strike_through:
            decoration.append("line-through")
        values.append(("text-decoration-line", " ".join(decoration) or "none"))
    if style.line_height is not None:
        values.append(("line-height", f"{style.line_height:g}"))
    return ";".join(f"{k}:{v}" for k, v in values)


def stylesheet(styles: list[Style]) -> bytes:
    baseline = (
        "body{font-family:serif;line-height:1.5}"
        "[data-ava-text]{white-space:pre-wrap}"
        "img{max-width:100%;max-height:75vh;width:auto;height:auto;object-fit:contain;display:block;margin-inline:auto}table{border-collapse:collapse;max-width:100%}"
        "th,td{padding:.25em;text-align:start}pre{white-space:pre-wrap;overflow-wrap:anywhere}"
        ".note-returns{font-size:.8em}.verse{font-family:inherit}"
        ".caption{font-size:.9em}.credit{font-size:.8em}"
    )
    return (
        baseline + "\n" + "\n".join(f".{ident('style', s.id)}{{{declarations(s)}}}" for s in styles)
    ).encode("utf-8")
