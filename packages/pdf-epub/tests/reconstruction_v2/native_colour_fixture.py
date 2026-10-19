"""Authored source ink using a generic sampled function and an installed sRGB profile."""

from pathlib import Path

from PIL import ImageCms
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from tests.reconstruction_v2.native_layout_fixture import document


def colour_document(path: Path, *, mixed: bool = False, unsafe: str | None = None) -> Path:
    original = path.with_name("authored-gray.pdf")
    document(original)
    reader, writer = PdfReader(original), PdfWriter()
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    for source_page in reader.pages:
        page = writer.add_page(source_page)
        icc = DecodedStreamObject()
        icc.set_data(profile[:100] if unsafe == "profile" else profile)
        icc[NameObject("/N")] = NumberObject(3)
        icc[NameObject("/Alternate")] = NameObject("/DeviceRGB")
        function = DecodedStreamObject()
        function.set_data(bytes([255, 255, 255, 35, 31, 32]))
        for name, value in {"/FunctionType": 0, "/BitsPerSample": 8}.items():
            function[NameObject(name)] = NumberObject(value)
        for name, values in {
            "/Domain": [0, 1],
            "/Range": [0, 1] * 3,
            "/Size": [2],
            "/Encode": [0, 1],
            "/Decode": [0, 1] * 3,
        }.items():
            function[NameObject(name)] = ArrayObject([NumberObject(v) for v in values])
        space = ArrayObject(
            [
                NameObject("/Separation"),
                NameObject("/AuthoredInk"),
                ArrayObject([NameObject("/ICCBased"), writer._add_object(icc)]),
                writer._add_object(function),
            ]
        )
        page[NameObject("/Resources")][NameObject("/ColorSpace")] = DictionaryObject(
            {NameObject("/UniformInk"): space}
        )
        contents = page.get_contents().get_data()
        if unsafe == "opacity":
            page[NameObject("/Resources")][NameObject("/ExtGState")] = DictionaryObject(
                {NameObject("/Fade"): DictionaryObject({NameObject("/ca"): NumberObject(0)})}
            )
            contents = b"/Fade gs\n" + contents
        elif unsafe == "clip":
            contents = b"0 0 100 100 re W n\n" + contents
        elif unsafe == "hidden":
            contents = b"3 Tr\n" + contents
        elif unsafe == "rotate":
            page[NameObject("/Rotate")] = NumberObject(90)
        elif unsafe == "offset":
            page[NameObject("/CropBox")] = ArrayObject([NumberObject(v) for v in [1, 1, 346, 582]])
        if mixed:
            contents = contents.replace(b"BT /F1 10.5", b"0 g BT /F1 10.5", 1)
        stream = DecodedStreamObject()
        stream.set_data(b"/UniformInk cs 1 scn\n" + contents)
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)
    return path
