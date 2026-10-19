"""Authored colour resources: exact arithmetic, real CMS conversion and strict refusals."""

import hashlib
import struct
import unittest
import zlib
from dataclasses import FrozenInstanceError

from PIL import ImageCms
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DecodedStreamObject,
    DictionaryObject,
    EncodedStreamObject,
    FloatObject,
    NameObject,
    NumberObject,
)

from ava_pdf_epub.reconstruction_v2.native_colour_value import (
    NativeColourUnavailable,
    resolve_source_colour,
)


def source_space(profile=None, samples=None, size=2, flate=False):
    profile = (
        profile
        if profile is not None
        else ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    )
    data = bytes([0, 0, 0, 35, 31, 32]) if samples is None else samples
    icc = EncodedStreamObject() if flate else DecodedStreamObject()
    function = EncodedStreamObject() if flate else DecodedStreamObject()
    if flate:
        for item, payload in [(icc, profile), (function, data)]:
            item._data = zlib.compress(payload)
            item[NameObject("/Filter")] = NameObject("/FlateDecode")
    else:
        icc.set_data(profile)
        function.set_data(data)
    icc[NameObject("/N")] = NumberObject(3)
    icc[NameObject("/Alternate")] = NameObject("/DeviceRGB")
    for key, value in {"/FunctionType": 0, "/BitsPerSample": 8, "/Order": 1}.items():
        function[NameObject(key)] = NumberObject(value)
    function[NameObject("/Domain")] = ArrayObject([NumberObject(0), NumberObject(1)])
    function[NameObject("/Range")] = ArrayObject([NumberObject(v) for v in [0, 1] * 3])
    function[NameObject("/Size")] = ArrayObject([NumberObject(size)])
    return ArrayObject(
        [
            NameObject("/Separation"),
            NameObject("/AuthoredInk"),
            ArrayObject([NameObject("/ICCBased"), icc]),
            function,
        ]
    )


def tags(data):
    n = int.from_bytes(data[128:132], "big")
    return {
        data[132 + i * 12 : 136 + i * 12]: struct.unpack(">II", data[136 + i * 12 : 144 + i * 12])
        for i in range(n)
    }


class NativeColourValueTests(unittest.TestCase):
    def resolve(self, space, tint=1.0, intent="/RelativeColorimetric"):
        return resolve_source_colour(space, (tint,), intent)

    def test_real_srgb_conversion_exact_value_and_source_bytes_immutable(self):
        space = source_space()
        before = (space[2][1]._data, space[3]._data, str(space))
        result = self.resolve(space)
        self.assertEqual((35, 31, 32), result.rgb)
        self.assertEqual(hashlib.sha256(space[2][1]._data).hexdigest(), result.profile_sha256)
        self.assertEqual(hashlib.sha256(space[3]._data).hexdigest(), result.function_sha256)
        self.assertEqual(before, (space[2][1]._data, space[3]._data, str(space)))
        with self.assertRaises(FrozenInstanceError):
            result.intent = "invented"
        self.assertEqual(
            result.output_profile_identity_sha256,
            self.resolve(space).output_profile_identity_sha256,
        )

    def test_flate_resources_match_uncompressed_expected_value_and_hashes(self):
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        plain, compressed = source_space(profile), source_space(profile, flate=True)
        a, b = self.resolve(plain), self.resolve(compressed)
        self.assertEqual(a, b)

    def test_changed_trc_same_description_and_size_changes_expected_value(self):
        data = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        changed = bytearray(data)
        table = tags(data)
        for offset, _size in {table[key] for key in (b"rTRC", b"gTRC", b"bTRC")}:
            self.assertEqual(b"para", data[offset : offset + 4])
            self.assertEqual(3, int.from_bytes(data[offset + 8 : offset + 10], "big"))
            changed[offset + 12 : offset + 16] = struct.pack(">i", 65536)  # authored gamma1
        self.assertEqual(len(data), len(changed))
        offset, size = table[b"desc"]
        self.assertEqual(data[offset : offset + size], bytes(changed[offset : offset + size]))
        a, b = self.resolve(source_space(data)), self.resolve(source_space(bytes(changed)))
        self.assertNotEqual(a.rgb, b.rgb)
        self.assertNotEqual(a.profile_sha256, b.profile_sha256)
        self.assertNotEqual(a.colour_space_sha256, b.colour_space_sha256)

    def test_malformed_profile_never_borrows_a_fallback_value(self):
        data = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        bad = [data[:100], data[:36] + b"bad!" + data[40:], data[:16] + b"CMYK" + data[20:]]
        for profile in bad:
            with (
                self.subTest(profileBytes=len(profile)),
                self.assertRaises(NativeColourUnavailable),
            ):
                self.resolve(source_space(profile))

    def test_partial_tag_overlap_refuses_but_identical_trc_alias_is_allowed(self):
        data = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        self.resolve(source_space(data))  # Pillow's three channel TRCs legitimately alias.
        changed = bytearray(data)
        n = int.from_bytes(data[128:132], "big")
        entries = [132 + i * 12 for i in range(n)]
        first, second = entries[:2]
        offset, size = struct.unpack(">II", data[first + 4 : first + 12])
        changed[second + 4 : second + 12] = struct.pack(">II", offset + 4, size)
        with self.assertRaisesRegex(NativeColourUnavailable, "TAG_OVERLAP"):
            self.resolve(source_space(bytes(changed)))

    def test_exact_grid_and_decode_bytes_without_tolerance(self):
        self.assertEqual((0, 0, 0), self.resolve(source_space(), 0.0).rgb)
        with self.assertRaisesRegex(NativeColourUnavailable, "OFF_GRID"):
            self.resolve(source_space(), 0.5)
        with self.assertRaisesRegex(NativeColourUnavailable, "OFF_GRID"):
            self.resolve(source_space(samples=bytes(range(33)), size=11), 0.1)
        space = source_space()
        space[3][NameObject("/Decode")] = ArrayObject([NumberObject(v) for v in [0, 2] * 3])
        self.assertEqual((70, 62, 64), self.resolve(space).rgb)

    def test_unknown_intents_component_ranges_and_colourants_refuse(self):
        for intent in ("/Perceptual", "/AbsoluteColorimetric", "RelativeColorimetric", "unknown"):
            with self.subTest(intent=intent), self.assertRaises(NativeColourUnavailable):
                self.resolve(source_space(), intent=intent)
        for name in ("/None", "/All"):
            space = source_space()
            space[1] = NameObject(name)
            with self.assertRaises(NativeColourUnavailable):
                self.resolve(space)
        space = source_space()
        space[2][1][NameObject("/N")] = NumberObject(4)
        with self.assertRaises(NativeColourUnavailable):
            self.resolve(space)

    def test_bounded_decoder_refuses_bombs_filters_predictors_and_trailing_data(self):
        for payload in (zlib.compress(b"X" * (4 * 1024 * 1024 + 1)), b"not zlib"):
            space = source_space(flate=True)
            space[2][1]._data = payload
            with self.assertRaises(NativeColourUnavailable):
                self.resolve(space)

    def test_function_boolean_integer_fields_and_nonbyte_outputs_refuse(self):
        for field, value in (
            ("/FunctionType", BooleanObject(False)),
            ("/BitsPerSample", FloatObject(8)),
            ("/Order", NumberObject(3)),
        ):
            space = source_space()
            space[3][NameObject(field)] = value
            with self.subTest(field=field), self.assertRaises(NativeColourUnavailable):
                self.resolve(space)
        space = source_space()
        space[3][NameObject("/Decode")] = ArrayObject([FloatObject(v) for v in [0, 0.5] * 3])
        with self.assertRaisesRegex(NativeColourUnavailable, "OUTPUT_OFF_GRID"):
            self.resolve(space)

    def test_singular_matrix_and_malformed_adaptation_are_rejected_before_cms(self):
        data = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        table = tags(data)
        changed = bytearray(data)
        offset, size = table[b"rXYZ"]
        changed[offset + 8 : offset + size] = b"\0" * (size - 8)
        with self.assertRaisesRegex(NativeColourUnavailable, "ICC_MATRIX"):
            self.resolve(source_space(bytes(changed)))
        changed = bytearray(data)
        offset, _ = table[b"chad"]
        changed[offset : offset + 4] = b"fake"
        with self.assertRaisesRegex(NativeColourUnavailable, "ICC_ADAPTATION"):
            self.resolve(source_space(bytes(changed)))

    def test_sampled_curve_family_and_monotonic_negative(self):
        data = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        table = tags(data)
        changed = bytearray(data)
        # Replace the aliased para3 payload with an authored ten-sample curve.
        offset, size = table[b"rTRC"]
        self.assertEqual(32, size)
        payload = b"curv\0\0\0\0" + struct.pack(
            ">I10H", 10, *[round(i * 65535 / 9) for i in range(10)]
        )
        changed[offset : offset + size] = payload + b"\0" * (size - len(payload))
        self.resolve(source_space(bytes(changed)))
        changed[offset + 14 : offset + 16] = struct.pack(">H", 65535)
        with self.assertRaisesRegex(NativeColourUnavailable, "ICC_CURVE"):
            self.resolve(source_space(bytes(changed)))

    def test_refusal_never_echoes_an_untrusted_code_or_cms_message(self):
        self.assertEqual(
            "COLOUR_CONVERSION_UNAVAILABLE",
            NativeColourUnavailable("ARBITRARY_DOCUMENT_WORDS").code,
        )
        space = source_space(flate=True)
        space[3]._data += b"trailing"
        with self.assertRaises(NativeColourUnavailable):
            self.resolve(space)
        for field, value in [
            ("/Filter", NameObject("/DCTDecode")),
            ("/DecodeParms", DictionaryObject({NameObject("/Predictor"): NumberObject(12)})),
        ]:
            space = source_space(flate=True)
            space[3][NameObject(field)] = value
            with self.assertRaises(NativeColourUnavailable):
                self.resolve(space)


if __name__ == "__main__":
    unittest.main()
