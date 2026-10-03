"""Resolve printed marker families from label sequence, not alphabet case alone."""

import re

MARKER = re.compile(r"^(?P<marker>\d+[.)]|[A-Za-z][.)]|[ivxlcdmIVXLCDM]{2,12}[.)]|[•▪●–-])\s+")


def roman_value(label: str) -> int:
    values = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
    if not re.fullmatch(r"(?i)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})", label):
        raise ValueError("Invalid Roman marker")
    result, previous = 0, 0
    for char in reversed(label.lower()):
        value = values[char]
        result += -value if value < previous else value
        previous = max(previous, value)
    return result


def marker_value(label: str, following: str | None) -> int | None:
    value = label[:-1]
    if value.isdecimal():
        return int(value)
    if not value.isalpha():
        return None
    if len(value) > 1 or (value.lower() == "i" and following and following[:-1].lower() == "ii"):
        return roman_value(value)
    return ord(value.lower()) - 96


def marker_style(label: str, start: int | None) -> str:
    value = label[:-1]
    if label[0].isdigit():
        return "decimal"
    if not label[0].isalpha():
        return "bullet"
    roman = len(value) > 1 or (value.lower() in "ivxlcdm" and start != ord(value.lower()) - 96)
    return ("upper-" if value.isupper() else "lower-") + ("roman" if roman else "alpha")
