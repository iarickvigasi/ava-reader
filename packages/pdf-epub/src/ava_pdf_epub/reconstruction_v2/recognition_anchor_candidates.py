"""Finite literal digit alternatives, never Unicode normalization or a text rewrite."""

from typing import Any

ASCII_DIGITS = "0123456789"
SCRIPT_DIGITS = {"super": "⁰¹²³⁴⁵⁶⁷⁸⁹", "sub": "₀₁₂₃₄₅₆₇₈₉"}


def allowed_quotations(text: str, span: dict[str, Any]) -> list[str]:
    quote = span["anchor"]["exact_text"]
    candidates = [quote] if quote in text else []
    script = SCRIPT_DIGITS.get((span.get("style") or {}).get("vertical_align", ""))
    if script and quote:
        alternate = None
        if all(char in ASCII_DIGITS for char in quote):
            alternate = quote.translate(str.maketrans(ASCII_DIGITS, script))
        elif all(char in script for char in quote):
            alternate = quote.translate(str.maketrans(script, ASCII_DIGITS))
        if alternate is not None and alternate in text and alternate not in candidates:
            candidates.append(alternate)
    return candidates
