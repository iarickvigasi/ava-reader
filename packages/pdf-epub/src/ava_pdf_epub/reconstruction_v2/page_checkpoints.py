"""Private, hash-verified observations with a byte-bounded two-page decode cache."""

import hashlib
from collections import OrderedDict
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import overload

from ..contracts.private_files import snapshot
from ..worker_observation import observe
from .page_geometry import PageGeometry, geometry_from
from .prepared import PreparedPage

PAGE_BYTES = 32 * 1024 * 1024
TOTAL_BYTES = 1024 * 1024 * 1024


class PageCheckpoints(Sequence[PreparedPage]):
    def __init__(self, root: Path):
        self.root = root
        self._entries: list[tuple[str, str]] = []
        self._bytes = 0
        self._geometry: list[PageGeometry] = []
        self._cached: OrderedDict[int, tuple[int, PreparedPage]] = OrderedDict()
        self._cache_bytes = 0

    def append(self, page: PreparedPage) -> None:
        if page.observation.number != len(self) + 1 or len(self) >= 500:
            raise ValueError("Page checkpoint order or count differs")
        geometry = geometry_from(page.observation)
        data = page.model_dump_json().encode("utf-8")
        if len(data) > PAGE_BYTES or self._bytes + len(data) > TOTAL_BYTES:
            raise ValueError("Page checkpoint byte limit exceeded")
        name = f"page-{len(self) + 1:04d}.json"
        with (self.root / name).open("xb") as output:
            output.write(data)
        self._entries.append((name, hashlib.sha256(data).hexdigest()))
        self._bytes += len(data)
        self._geometry.append(geometry)

    def __len__(self) -> int:
        return len(self._entries)

    def clear_cache(self) -> None:
        """Drop mutable decoded observations before starting another assembly phase."""
        self._cached.clear()
        self._cache_bytes = 0

    def verify(self) -> None:
        """Recheck every private checkpoint, including pages not presently decoded."""
        for index in range(len(self)):
            self._read(index)

    @overload
    def __getitem__(self, index: int) -> PreparedPage: ...

    @overload
    def __getitem__(self, index: slice) -> Sequence[PreparedPage]: ...

    def __getitem__(self, index: int | slice) -> PreparedPage | Sequence[PreparedPage]:
        if isinstance(index, slice):
            return [self[i] for i in range(*index.indices(len(self)))]
        index, data = self._read(index)
        cached = self._cached.get(index)
        if cached is not None:
            self._cached.move_to_end(index)
            observe("reuse", "checkpoint_decode", True)
            return cached[1]
        observe("reuse", "checkpoint_decode", False)
        page = PreparedPage.model_validate_json(data)
        # Keep the same aggregate serialized bound as the former single-page cache.
        # Hash verification above still runs on every read, including cache hits.
        while self._cached and (
            len(self._cached) >= 2 or self._cache_bytes + len(data) > PAGE_BYTES
        ):
            _, (size, _) = self._cached.popitem(last=False)
            self._cache_bytes -= size
        self._cached[index] = (len(data), page)
        self._cache_bytes += len(data)
        return page

    def _read(self, index: int) -> tuple[int, bytes]:
        if index < 0:
            index += len(self)
        if not 0 <= index < len(self):
            raise IndexError(index)
        # Reverify even cached reads: a changed scratch file cannot supply observations.
        name, digest = self._entries[index]
        data = snapshot(self.root, name, PAGE_BYTES)
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError("Page checkpoint content identity changed")
        return index, data

    def geometry(self, index: int) -> PageGeometry:
        index, _ = self._read(index)
        return self._geometry[index]


def page_geometry(pages: Sequence[PreparedPage], index: int) -> PageGeometry:
    if isinstance(pages, PageCheckpoints):
        return pages.geometry(index)
    return geometry_from(pages[index].observation)


class PreparedPageMap(Mapping[int, PreparedPage]):
    def __init__(self, pages: Sequence[PreparedPage]):
        self.pages = pages

    def __len__(self) -> int:
        return len(self.pages)

    def __iter__(self) -> Iterator[int]:
        return iter(range(1, len(self.pages) + 1))

    def __getitem__(self, number: int) -> PreparedPage:
        if not 1 <= number <= len(self.pages):
            raise KeyError(number)
        page = self.pages[number - 1]
        if page.observation.number != number:
            raise ValueError("Page checkpoint index differs")
        return page
