"""Bounded source Function0/RGB ICC conversion; no PDF rendering or getter authority."""

import hashlib
import io
import json
import math
import struct
import zlib
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any

import PIL
from PIL import Image, ImageCms, _imagingcms, features
from pypdf.generic import ArrayObject, IndirectObject, NameObject, StreamObject

PROFILE_BYTES = 4 * 1024 * 1024
SAMPLE_BYTES = 4096 * 3
_CODES = frozenset(
    {
        "COLOUR_REFERENCE_UNRESOLVED",
        "COLOUR_NUMBER_INVALID",
        "COLOUR_ARRAY_INVALID",
        "COLOUR_INTEGER_INVALID",
        "COLOUR_STREAM_INVALID",
        "COLOUR_STREAM_BOUND",
        "COLOUR_PREDICTOR_UNSUPPORTED",
        "COLOUR_FILTER_UNSUPPORTED",
        "COLOUR_FUNCTION_UNSUPPORTED",
        "COLOUR_FUNCTION_SIZE",
        "COLOUR_FUNCTION_ENVELOPE",
        "COLOUR_TINT_OUT_OF_DOMAIN",
        "COLOUR_FUNCTION_OFF_GRID",
        "COLOUR_FUNCTION_BYTES",
        "COLOUR_OUTPUT_OFF_GRID",
        "COLOUR_ICC_SIZE",
        "COLOUR_ICC_HEADER",
        "COLOUR_ICC_FAMILY",
        "COLOUR_ICC_TABLE",
        "COLOUR_ICC_TAG",
        "COLOUR_ICC_TAG_OVERLAP",
        "COLOUR_ICC_CURVE",
        "COLOUR_ICC_CURVE_FAMILY",
        "COLOUR_ICC_MATRIX_REQUIRED",
        "COLOUR_ICC_LUT_UNSUPPORTED",
        "COLOUR_ICC_MATRIX",
        "COLOUR_ICC_ADAPTATION",
        "COLOUR_ICC_INTENT_UNSUPPORTED",
        "COLOUR_ICC_RESULT",
        "COLOUR_INTENT_UNSUPPORTED",
        "COLOUR_SPACE_UNSUPPORTED",
        "COLOUR_COLOURANT_UNSUPPORTED",
        "COLOUR_OPERANDS_UNSUPPORTED",
        "COLOUR_ALTERNATE_UNSUPPORTED",
        "COLOUR_ICC_COMPONENTS",
        "COLOUR_ICC_RANGE",
        "COLOUR_CONVERSION_UNAVAILABLE",
    }
)


class NativeColourUnavailable(ValueError):
    """A finite refusal; parser/CMS messages and document strings never escape."""

    def __init__(self, code: str):
        if code not in _CODES:
            code = "COLOUR_CONVERSION_UNAVAILABLE"
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class ExpectedColour:
    rgb: tuple[int, int, int]
    colour_space_sha256: str
    profile_sha256: str
    function_sha256: str
    intent: str
    cms_identity_sha256: str
    output_profile_identity_sha256: str


def _require(value: bool, code: str) -> None:
    if not value:
        raise NativeColourUnavailable(code)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _digest(value: object) -> str:
    return _sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def _object(value: Any) -> Any:
    # Only the selected resolved definition is consumed; no recursive resource walker.
    if isinstance(value, IndirectObject):
        value = value.get_object()
    _require(not isinstance(value, IndirectObject), "COLOUR_REFERENCE_UNRESOLVED")
    return value


def _fraction(value: Any) -> Fraction:
    _require(type(value) is not bool and isinstance(value, (int, float)), "COLOUR_NUMBER_INVALID")
    _require(math.isfinite(value), "COLOUR_NUMBER_INVALID")
    # Preserve the supplied float exactly. Decimal rounding cannot invent a grid point.
    return Fraction(value)


def _numbers(value: Any, count: int) -> list[Fraction]:
    _require(isinstance(value, (list, ArrayObject)) and len(value) == count, "COLOUR_ARRAY_INVALID")
    return [_fraction(v) for v in value]


def _integer(value: Any) -> int:
    _require(type(value) is not bool and isinstance(value, int), "COLOUR_INTEGER_INVALID")
    return int(value)


def _stream(value: Any, limit: int) -> tuple[StreamObject, bytes]:
    stream = _object(value)
    _require(isinstance(stream, StreamObject), "COLOUR_STREAM_INVALID")
    encoded = stream._data
    _require(type(encoded) is bytes and len(encoded) <= limit + 65536, "COLOUR_STREAM_BOUND")
    parms = stream.get("/DecodeParms")
    _require(parms is None or parms == {}, "COLOUR_PREDICTOR_UNSUPPORTED")
    filter_name = stream.get("/Filter")
    if filter_name is None:
        data = encoded
    else:
        _require(filter_name == "/FlateDecode", "COLOUR_FILTER_UNSUPPORTED")
        decoder = zlib.decompressobj()
        data = decoder.decompress(encoded, limit + 1)
        _require(len(data) <= limit and not decoder.unconsumed_tail, "COLOUR_STREAM_BOUND")
        _require(decoder.eof and not decoder.unused_data, "COLOUR_STREAM_INVALID")
    _require(0 < len(data) <= limit, "COLOUR_STREAM_BOUND")
    return stream, data


def _sample(function: Any, tint: float) -> tuple[tuple[int, int, int], str, dict[str, Any]]:
    fn, data = _stream(function, SAMPLE_BYTES)
    _require(
        _integer(fn.get("/FunctionType")) == 0
        and _integer(fn.get("/BitsPerSample")) == 8
        and _integer(fn.get("/Order", 1)) == 1,
        "COLOUR_FUNCTION_UNSUPPORTED",
    )
    size = _numbers(fn.get("/Size"), 1)[0]
    _require(size.denominator == 1 and 2 <= size <= 4096, "COLOUR_FUNCTION_SIZE")
    domain, ranges = _numbers(fn.get("/Domain"), 2), _numbers(fn.get("/Range"), 6)
    encode = _numbers(fn.get("/Encode", [0, int(size) - 1]), 2)
    decode = _numbers(fn.get("/Decode", fn.get("/Range")), 6)
    _require(domain == [0, 1] and ranges == [0, 1] * 3, "COLOUR_FUNCTION_ENVELOPE")
    t = _fraction(tint)
    _require(0 <= t <= 1, "COLOUR_TINT_OUT_OF_DOMAIN")
    index = encode[0] + t * (encode[1] - encode[0])
    _require(index.denominator == 1 and 0 <= index < size, "COLOUR_FUNCTION_OFF_GRID")
    _require(len(data) == int(size) * 3, "COLOUR_FUNCTION_BYTES")
    rgb = []
    for channel, sample in enumerate(data[int(index) * 3 : int(index) * 3 + 3]):
        lo, hi = decode[channel * 2 : channel * 2 + 2]
        value = lo + Fraction(sample, 255) * (hi - lo)
        _require(0 <= value <= 1 and (value * 255).denominator == 1, "COLOUR_OUTPUT_OFF_GRID")
        rgb.append(int(value * 255))
    projection = {
        "size": int(size),
        "domain": [str(v) for v in domain],
        "range": [str(v) for v in ranges],
        "encode": [str(v) for v in encode],
        "decode": [str(v) for v in decode],
        "order": 1,
        "bits": 8,
        "samples_sha256": _sha(data),
        "sample_bytes": len(data),
    }
    return (rgb[0], rgb[1], rgb[2]), _sha(data), projection


def _tags(data: bytes) -> dict[bytes, bytes]:
    _require(
        132 <= len(data) <= PROFILE_BYTES and int.from_bytes(data[:4], "big") == len(data),
        "COLOUR_ICC_SIZE",
    )
    _require(data[36:40] == b"acsp" and data[8] in {2, 4}, "COLOUR_ICC_HEADER")
    _require(
        data[12:16] in {b"mntr", b"scnr", b"prtr", b"spac"}
        and data[16:20] == b"RGB "
        and data[20:24] == b"XYZ ",
        "COLOUR_ICC_FAMILY",
    )
    count = int.from_bytes(data[128:132], "big")
    _require(1 <= count <= 256 and 132 + count * 12 <= len(data), "COLOUR_ICC_TABLE")
    tags: dict[bytes, bytes] = {}
    spans: list[tuple[int, int]] = []
    for index in range(count):
        tag, start, size = struct.unpack(">4sII", data[132 + index * 12 : 144 + index * 12])
        _require(
            tag not in tags
            and start % 4 == 0
            and start >= 132 + count * 12
            and size >= 8
            and start + size <= len(data),
            "COLOUR_ICC_TAG",
        )
        _require(
            all(
                (start, size) == old or start + size <= old[0] or old[0] + old[1] <= start
                for old in spans
            ),
            "COLOUR_ICC_TAG_OVERLAP",
        )
        spans.append((start, size))
        tags[tag] = data[start : start + size]
    return tags


def _trc(data: bytes) -> None:
    _require(data[4:8] == b"\0" * 4 and len(data) >= 12, "COLOUR_ICC_CURVE")
    if data[:4] == b"curv":
        count = int.from_bytes(data[8:12], "big")
        expected = 12 + count * 2
        _require(
            count <= 4096 and expected <= len(data) <= expected + 3 and not any(data[expected:]),
            "COLOUR_ICC_CURVE",
        )
        values = [int.from_bytes(data[12 + i * 2 : 14 + i * 2], "big") for i in range(count)]
        _require(count != 1 or values[0] > 0, "COLOUR_ICC_CURVE")
        _require(all(a <= b for a, b in zip(values, values[1:], strict=False)), "COLOUR_ICC_CURVE")
    elif data[:4] == b"para":
        kind = int.from_bytes(data[8:10], "big")
        counts = {0: 1, 3: 5}
        _require(kind in counts and data[10:12] == b"\0\0", "COLOUR_ICC_CURVE_FAMILY")
        _require(len(data) == 12 + counts[kind] * 4, "COLOUR_ICC_CURVE")
        parameters = [
            Fraction(v, 65536) for v in struct.unpack(">" + "i" * counts[kind], data[12:])
        ]
        _require(parameters[0] > 0, "COLOUR_ICC_CURVE")
        if kind == 3:
            _, a, b, c, d = parameters
            _require(a > 0 and c >= 0 and 0 <= d <= 1 and a * d + b >= 0, "COLOUR_ICC_CURVE")
    else:
        raise NativeColourUnavailable("COLOUR_ICC_CURVE_FAMILY")


def _matrix_profile(data: bytes) -> None:
    tags = _tags(data)
    _require(
        all(k in tags for k in (b"rXYZ", b"gXYZ", b"bXYZ", b"wtpt", b"rTRC", b"gTRC", b"bTRC")),
        "COLOUR_ICC_MATRIX_REQUIRED",
    )
    _require(
        not any(k.startswith((b"A2B", b"B2A", b"D2B", b"B2D")) for k in tags),
        "COLOUR_ICC_LUT_UNSUPPORTED",
    )
    xyz = []
    for key in (b"rXYZ", b"gXYZ", b"bXYZ", b"wtpt"):
        value = tags[key]
        _require(len(value) == 20 and value[:8] == b"XYZ \0\0\0\0", "COLOUR_ICC_MATRIX")
        xyz.append(struct.unpack(">iii", value[8:]))
    a, b, c = xyz[:3]
    determinant = (
        a[0] * (b[1] * c[2] - b[2] * c[1])
        - b[0] * (a[1] * c[2] - a[2] * c[1])
        + c[0] * (a[1] * b[2] - a[2] * b[1])
    )
    _require(determinant != 0 and xyz[3][1] > 0, "COLOUR_ICC_MATRIX")
    for key in (b"rTRC", b"gTRC", b"bTRC"):
        _trc(tags[key])
    if b"chad" in tags:
        adaptation = tags[b"chad"]
        _require(
            len(adaptation) == 44 and adaptation[:8] == b"sf32\0\0\0\0", "COLOUR_ICC_ADAPTATION"
        )
        m = struct.unpack(">9i", adaptation[8:])
        _require(
            m[0] * (m[4] * m[8] - m[5] * m[7])
            - m[1] * (m[3] * m[8] - m[5] * m[6])
            + m[2] * (m[3] * m[7] - m[4] * m[6])
            != 0,
            "COLOUR_ICC_ADAPTATION",
        )


def _convert(profile_bytes: bytes, rgb: tuple[int, int, int]) -> tuple[tuple[int, int, int], str]:
    _matrix_profile(profile_bytes)
    profile = ImageCms.ImageCmsProfile(io.BytesIO(profile_bytes))
    intent = ImageCms.Intent.RELATIVE_COLORIMETRIC
    _require(
        ImageCms.isIntentSupported(profile, intent, ImageCms.Direction.INPUT) == 1,
        "COLOUR_ICC_INTENT_UNSUPPORTED",
    )
    output = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    output_bytes = output.tobytes()
    # Only this tool-generated target has a volatile creation time. Source hashes are full bytes.
    output_identity = _sha(output_bytes[:24] + b"\0" * 12 + output_bytes[36:])
    transform = ImageCms.buildTransformFromOpenProfiles(
        profile,
        output,
        "RGB",
        "RGB",
        renderingIntent=intent,
        flags=ImageCms.Flags.NOOPTIMIZE | ImageCms.Flags.NOCACHE,
    )
    with Image.new("RGB", (1, 1), rgb) as swatch:
        converted = ImageCms.applyTransform(swatch, transform)
        if converted is None:
            raise NativeColourUnavailable("COLOUR_ICC_RESULT")
        try:
            value = converted.getpixel((0, 0))
        finally:
            converted.close()
    if not (
        isinstance(value, tuple)
        and len(value) == 3
        and all(type(v) is int and 0 <= v <= 255 for v in value)
    ):
        raise NativeColourUnavailable("COLOUR_ICC_RESULT")
    return (int(value[0]), int(value[1]), int(value[2])), output_identity


def _cms_identity() -> str:
    return _digest(
        {
            "pillow": PIL.__version__,
            "lcms": features.version("littlecms2"),
            "ImageCms": _sha(Path(ImageCms.__file__).read_bytes()),
            "nativeCms": _sha(Path(_imagingcms.__file__).read_bytes()),
        }
    )


def resolve_source_colour(
    colour_space: Any, operands: tuple[float, ...], rendering_intent: str
) -> ExpectedColour:
    """Resolve a supported source colour; capture/opacity/PDFium agreement are separate gates."""
    try:
        _require(rendering_intent == "/RelativeColorimetric", "COLOUR_INTENT_UNSUPPORTED")
        cs = _object(colour_space)
        _require(
            isinstance(cs, (list, ArrayObject)) and len(cs) == 4 and cs[0] == "/Separation",
            "COLOUR_SPACE_UNSUPPORTED",
        )
        name = cs[1]
        _require(
            isinstance(name, NameObject) and 0 < len(name) <= 128 and name not in {"/None", "/All"},
            "COLOUR_COLOURANT_UNSUPPORTED",
        )
        _require(type(operands) is tuple and len(operands) == 1, "COLOUR_OPERANDS_UNSUPPORTED")
        alternate = _object(cs[2])
        _require(
            isinstance(alternate, (list, ArrayObject))
            and len(alternate) == 2
            and alternate[0] == "/ICCBased",
            "COLOUR_ALTERNATE_UNSUPPORTED",
        )
        icc, data = _stream(alternate[1], PROFILE_BYTES)
        _require(
            _integer(icc.get("/N")) == 3 and icc.get("/Alternate", "/DeviceRGB") == "/DeviceRGB",
            "COLOUR_ICC_COMPONENTS",
        )
        _require(_numbers(icc.get("/Range", [0, 1] * 3), 6) == [0, 1] * 3, "COLOUR_ICC_RANGE")
        rgb, function_sha, parameters = _sample(cs[3], operands[0])
        value, output_identity = _convert(data, rgb)
        return ExpectedColour(
            value,
            _digest(
                {
                    "family": "Separation",
                    "colourant": str(name),
                    "icc": _sha(data),
                    "N": 3,
                    "range": [0, 1] * 3,
                    "alternate": "DeviceRGB",
                    "function": parameters,
                }
            ),
            _sha(data),
            function_sha,
            rendering_intent,
            _cms_identity(),
            output_identity,
        )
    except NativeColourUnavailable:
        raise
    except Exception:
        raise NativeColourUnavailable("COLOUR_CONVERSION_UNAVAILABLE") from None
