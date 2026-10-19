"""In-memory host exchanges source-bound fixtures; never a provider or acceptance repair."""

import base64
import hashlib
import io
import json
import struct

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes


class PeerInput:
    def __init__(self):
        self.pending = bytearray()

    def read(self, size):
        result = bytes(self.pending[:size])
        del self.pending[:size]
        return result


class PeerOutput(io.BytesIO):
    def __init__(self, callback):
        super().__init__()
        self.incoming = PeerInput()
        self.callback = callback
        self.pending = bytearray()
        self.controls = []
        self.artifacts = bytearray()
        self.streaming = False

    def write(self, data):
        size = super().write(data)
        if self.streaming:
            self.artifacts.extend(data)
            return size
        self.pending.extend(data)
        if len(self.pending) < 4:
            return size
        length = struct.unpack(">I", self.pending[:4])[0]
        if len(self.pending) < length + 4:
            return size
        packet = json.loads(self.pending[4 : length + 4])
        del self.pending[: length + 4]
        self.controls.append(packet)
        if packet["kind"] == "artifacts":
            self.streaming = True
        elif packet["kind"] != "refusal":
            response = self.callback(packet)
            trailing = b""
            if isinstance(response, tuple):
                response, trailing = response
            raw = (
                response
                if isinstance(response, bytes)
                else json_bytes({**packet, "payload": response})
            )
            self.incoming.pending.extend(struct.pack(">I", len(raw)) + raw + trailing)
        return size

    def decoded_artifacts(self):
        rows = [json.loads(line) for line in self.artifacts.splitlines()]
        header = rows[0]
        result = {item["path"]: bytearray() for item in header["artifacts"]}
        for row in rows[1:-1]:
            if row["offset"] != len(result[row["path"]]):
                raise AssertionError("Noncontiguous fixture stream")
            result[row["path"]].extend(base64.b64decode(row["base64"], validate=True))
        if rows[-1] != {"complete": True}:
            raise AssertionError("Missing completion marker")
        for item in header["artifacts"]:
            data = result[item["path"]]
            if (
                len(data) != item["byte_length"]
                or hashlib.sha256(data).hexdigest() != item["sha256"]
            ):
                raise AssertionError("Fixture artifact bytes differ from manifest")
        return {path: bytes(data) for path, data in result.items()}
