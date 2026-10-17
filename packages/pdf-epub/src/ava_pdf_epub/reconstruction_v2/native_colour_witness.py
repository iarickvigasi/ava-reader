"""Private source/tool-bound paint proof. Importing its schema initializes no colour SDK."""

import hashlib
import json
from typing import TYPE_CHECKING, Annotated, Any, Literal, cast

from pydantic import BaseModel, Field

from ..contracts.common import Digest, Record
from ..contracts.profiles import ProfileId
from .native_layout_policy import NativeLayoutPolicy
from .observations import PageObservation
from .segments import Segment

if TYPE_CHECKING:
    from .native_colour_capture import ColourCapture
    from .source_preparation import SourcePreparation

COLOURS = {"color", "paint_color", "paint_ink_color"}


def digest(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        ).encode()
    ).hexdigest()


def colours(value: Any, path: str = "") -> dict[str, Any]:
    result: dict[str, Any] = {}
    if isinstance(value, BaseModel):
        for key in type(value).model_fields:
            if key == "native_colour_witness":
                continue
            item = getattr(value, key)
            target = path + "/" + key
            if key in COLOURS:
                result[target] = item  # Includes explicit absence/None.
            else:
                result.update(colours(item, target))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            result.update(colours(item, path + "/" + str(index)))
    return result


def primary(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k: primary(v) for k, v in value.items() if k not in COLOURS | {"native_colour_witness"}
        }
    if isinstance(value, list):
        return [primary(v) for v in value]
    return value


class NativeColourWitness(Record):
    version: Literal["ava-native-uniform-colour-witness-1"]
    source_layout_policy: NativeLayoutPolicy
    profile_id: ProfileId
    source_sha256: Digest
    source_byte_length: int = Field(ge=1, le=52428800)
    source_page_count: int = Field(ge=1, le=500)
    page: int = Field(ge=1, le=500)
    view_sha256: Digest
    render_sha256: Digest
    frame: list[float] = Field(min_length=4, max_length=4)
    rendering_intent: Literal["/RelativeColorimetric"]
    rgb: list[Annotated[int, Field(ge=0, le=255)]] = Field(min_length=3, max_length=3)
    colour_space_sha256: Digest
    profile_sha256: Digest
    function_sha256: Digest
    cms_identity_sha256: Digest
    output_profile_identity_sha256: Digest
    object_sha256: Digest
    tool_sha256: Digest
    raw_glyph_sha256: Digest
    shows: int = Field(ge=1, le=50000)
    glyphs: int = Field(ge=1, le=200000)
    observation_primary_sha256: Digest
    observation_overlay_sha256: Digest
    segment_overlay_sha256: Digest


def make_witness(
    preparation: "SourcePreparation",
    page: PageObservation,
    segments: list[Segment],
    capture: "ColourCapture",
) -> NativeColourWitness:
    expected = capture.state.expected
    assert (
        preparation.source_layout_policy is not None and capture.valid and capture.raw_glyph_sha256
    )
    return NativeColourWitness(
        version="ava-native-uniform-colour-witness-1",
        source_layout_policy=preparation.source_layout_policy,
        profile_id=preparation.profile_id,
        source_sha256=preparation.sha256,
        source_byte_length=preparation.size,
        source_page_count=preparation.count,
        page=page.number,
        view_sha256=capture.view_sha256,
        render_sha256=page.render_sha256,
        frame=capture.frame,
        rendering_intent=cast(Literal["/RelativeColorimetric"], expected.intent),
        rgb=list(expected.rgb),
        colour_space_sha256=expected.colour_space_sha256,
        profile_sha256=expected.profile_sha256,
        function_sha256=expected.function_sha256,
        cms_identity_sha256=expected.cms_identity_sha256,
        output_profile_identity_sha256=expected.output_profile_identity_sha256,
        object_sha256=capture.objects.object_sha256,
        tool_sha256=capture.objects.tool_sha256,
        raw_glyph_sha256=capture.raw_glyph_sha256,
        shows=capture.shows,
        glyphs=capture.glyphs,
        observation_primary_sha256=digest(primary(page.model_dump())),
        observation_overlay_sha256=digest(colours(page)),
        segment_overlay_sha256=digest([colours(s) for s in segments]),
    )


def validate_witness(page: Any) -> None:
    witness = page.native_colour_witness
    if witness is None:
        return
    if (
        page.source_sha256,
        page.source_byte_length,
        page.source_page_count,
        page.profile_id,
        page.source_layout_policy,
        page.observation.number,
        page.observation.render_sha256,
    ) != (
        witness.source_sha256,
        witness.source_byte_length,
        witness.source_page_count,
        witness.profile_id,
        witness.source_layout_policy,
        witness.page,
        witness.render_sha256,
    ):
        raise ValueError("Native colour witness identity differs")
    if (
        digest(primary(page.observation.model_dump())) != witness.observation_primary_sha256
        or digest(colours(page.observation)) != witness.observation_overlay_sha256
        or digest([colours(s) for s in page.native_segments]) != witness.segment_overlay_sha256
    ):
        raise ValueError("Native colour applied overlay differs")
    ink = "#" + "".join(f"{v:02x}" for v in witness.rgb)
    display = None if ink == "#000000" else ink
    if any(
        g.paint_ink_color != ink or g.paint_color != display
        for line in page.observation.lines
        for g in line.glyphs
    ):
        raise ValueError("Native colour glyph overlay differs")
