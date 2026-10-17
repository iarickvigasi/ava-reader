"""Finite typed source styles over an accessible reflowable editorial stylesheet."""

from __future__ import annotations

from collections.abc import Iterable

from .models import Style

BASE_CSS = """@charset "UTF-8";
html { color-scheme: light dark; }
body { font-family: serif; font-size: 1em; line-height: 1.5;
  margin: 0 auto; padding: 0.75em 5%; max-width: 38em; overflow-wrap: break-word; }
section { margin: 0; }
h1, h2, h3, h4, h5, h6 { font-family: serif; line-height: 1.2;
  font-weight: normal; break-after: avoid; page-break-after: avoid; }
h1 { text-align: center; font-size: 1.6em; margin: 2.5em 0 1.6em; }
h2 { font-size: 1.35em; margin: 1.8em 0 0.8em; }
h3, h4, h5, h6 { margin: 1.4em 0 0.6em; }
p { margin: 0; orphans: 2; widows: 2; }
.body + .body { text-indent: 1.25em; }
.first { text-indent: 0; }
blockquote { margin: 1em 1.4em; }
.verse, .code { white-space: pre-wrap; overflow-wrap: anywhere; margin: 1em 0; }
.code { font-family: monospace; }
.smallcaps { font-variant: small-caps; }
.multiline-list { white-space: pre-line; list-style-type: none; }
figure { margin: 1.4em 0; text-align: center; break-inside: avoid; }
img { max-width: 100%; height: auto; }
figcaption { margin-top: 0.6em; font-size: 0.9em; text-align: start; }
.notes { margin-top: 2em; border-top: 0.06em solid currentColor; padding-top: 0.8em; }
.note { margin: 0.65em 0; font-size: 0.9em; }
.note-label { font-weight: bold; }
.noteref { vertical-align: super; font-size: 0.75em; line-height: 0; }
.backlinks { margin-left: 0.4em; font-size: 0.85em; }
.pagebreak { display: inline; }
.cover { text-align: center; padding: 0; }
.cover img { max-height: 95vh; object-fit: contain; }
nav ol { padding-left: 1.25em; }
nav li { margin: 0.5em 0; }
hr { width: 25%; margin: 1.4em auto; }
"""


def compile_styles(styles: Iterable[Style]) -> tuple[str, dict[str, str]]:
    """Equal style records share one deterministic class; no raw CSS is accepted."""
    unique = {style.model_dump_json(): style for style in styles}
    names = {key: f"s{index:04d}" for index, key in enumerate(sorted(unique))}
    css = [BASE_CSS]
    default = Style()
    for key, name in names.items():
        style = unique[key]
        observed = set(style.observed)
        declarations: list[str] = []
        if style.family != default.family or "family" in observed:
            declarations.append(f"font-family:{style.family}")
        if style.align != default.align or "align" in observed:
            declarations.append(f"text-align:{style.align}")
        if style.size != default.size or "size" in observed:
            declarations.append(f"font-size:{style.size:g}em")
        if style.indent != default.indent or "indent" in observed:
            declarations.append(f"text-indent:{style.indent:g}em")
        if style.space_before != default.space_before or "space_before" in observed:
            declarations.append(f"margin-top:{style.space_before:g}em")
        if style.bold or "bold" in observed:
            declarations.append(f"font-weight:{'bold' if style.bold else 'normal'}")
        if style.italic or "italic" in observed:
            declarations.append(f"font-style:{'italic' if style.italic else 'normal'}")
        if style.small_caps or "small_caps" in observed:
            declarations.append(f"font-variant:{'small-caps' if style.small_caps else 'normal'}")
        # Every accepted style has a class, even when it inherits the editorial defaults.
        # Equal-specificity source classes come after editorial paragraph defaults.
        css.append(f".{name}.{name} {{{';'.join(declarations)}}}\n")
    return "".join(css), names
