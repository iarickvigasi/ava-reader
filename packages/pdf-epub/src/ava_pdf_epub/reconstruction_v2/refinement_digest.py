"""Hash complete original observations, including text/spans/geometry and observed styles."""

import hashlib
import json

from .segments import Segment


def observation_digest(segments: list[Segment]) -> str:
    values = [s.model_dump(mode="json") for s in segments]
    return hashlib.sha256(
        json.dumps(values, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
