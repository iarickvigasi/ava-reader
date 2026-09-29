"""Read a bounded ZIP in memory; reject aliases/traversal/duplicates before decompression."""

import io
import re
import stat
import zipfile

from .assets import MAX_EXPANDED_BYTES

MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_ENTRY_BYTES = 200 * 1024 * 1024
MAX_ENTRIES = 24000


def read_archive(data: bytes) -> dict[str, bytes]:
    if len(data) > MAX_ARCHIVE_BYTES:
        raise ValueError("EPUB archive bound exceeded")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_ENTRIES:
            raise ValueError("EPUB entry count bound exceeded")
        if infos[0].filename != "mimetype" or infos[0].compress_type != zipfile.ZIP_STORED:
            raise ValueError("EPUB mimetype is not first and stored")
        names = [i.filename for i in infos]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate EPUB entry")
        total = 0
        for info in infos:
            if info.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                raise ValueError("Unsupported EPUB compression")
            if info.orig_filename != info.filename:
                raise ValueError("Aliased EPUB entry")
            safe = r"[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*"
            if not re.fullmatch(safe, info.filename):
                raise ValueError("Unsafe EPUB entry path")
            if info.flag_bits & 1 or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError("Encrypted or linked EPUB entry")
            if info.file_size > MAX_ENTRY_BYTES:
                raise ValueError("EPUB member bound exceeded")
            total += info.file_size
        if total > MAX_EXPANDED_BYTES:
            raise ValueError("EPUB expanded byte bound exceeded")
        return {info.filename: archive.read(info) for info in infos}
