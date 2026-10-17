"""Assembly-local role identity and separately measured source indentation."""

from dataclasses import dataclass


@dataclass(frozen=True)
class IndexEntryReceipt:
    owner_identity: str
    indent_em: float | None = None
    block_indent_em: float | None = None
