"""Visible glyph controls distinguish short raster passages from ordinary graphic bands."""

import unittest

from PIL import Image, ImageDraw, ImageFont, ImageOps

from ava_pdf_epub.reconstruction_v2.raster_text import raster_text


def text_image(lines: list[str]) -> Image.Image:
    image = Image.new("L", (680, max(60, 38 * len(lines))), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=24)
    for row, line in enumerate(lines):
        draw.text((8, 4 + row * 38), line, fill="black", font=font)
    return image


class RasterText(unittest.TestCase):
    def test_short_verse_prose_and_word_keep_aspect_across_scales(self) -> None:
        samples = [
            [
                "One light above the water,",
                "One shadow on the foam,",
                "Four windows guide us home.",
            ],
            ["A small paragraph contains essential reading text."],
            ["Two compact prose lines survive.", "The native paragraph remains authoritative."],
            ["NOTE"],
            ["NO"],
            ["MAP"],
        ]
        for lines in samples:
            for scale in [1, 2, 4]:
                with self.subTest(lines=lines, scale=scale):
                    image = text_image(lines)
                    image = image.resize((image.width * scale, image.height * scale))
                    self.assertTrue(raster_text(image))
                    self.assertTrue(raster_text(ImageOps.invert(image)))

    def test_gray_background_and_outlined_symbols_are_visual_review_candidates(self) -> None:
        text = text_image(["Read the short gray-panel text."])
        panel = ImageOps.colorize(text, black=(240, 240, 240), white=(100, 100, 100))
        self.assertTrue(raster_text(panel))
        symbols = Image.new("L", (600, 100), "white")
        draw = ImageDraw.Draw(symbols)
        for x in [20, 40, 60, 80]:
            draw.rectangle((x, 20, x + 9, 37), outline="black", width=2)
        # These can resemble glyphs; source-bound recognition decides text versus figure.
        self.assertTrue(raster_text(symbols))

    def test_graphic_bands_shapes_and_grid_do_not_request_recognition(self) -> None:
        for kind in ["blank", "solid", "circle", "bars", "tiles", "grid"]:
            image = Image.new("L", (680, 180), "white")
            draw = ImageDraw.Draw(image)
            if kind == "solid":
                draw.rectangle((20, 20, 650, 160), fill="black")
            if kind == "circle":
                draw.ellipse((180, 20, 330, 170), outline="black", width=4)
            if kind == "bars":
                for y in [20, 70, 120]:
                    draw.rectangle((20, y, 650, y + 18), fill="black")
            if kind == "tiles":
                for y in [20, 100]:
                    for x in [40, 200, 360, 520]:
                        draw.rectangle((x, y, x + 35, y + 35), fill="black")
            if kind == "grid":
                for y in [20, 60, 100, 140]:
                    draw.line((20, y, 650, y), fill="black", width=2)
                for x in [20, 180, 340, 500, 650]:
                    draw.line((x, 20, x, 140), fill="black", width=2)
            with self.subTest(kind=kind):
                self.assertFalse(raster_text(image))
                self.assertFalse(raster_text(ImageOps.invert(image)))

    def test_low_resolution_extreme_aspect_and_single_stroke_are_not_text_claims(self) -> None:
        self.assertFalse(raster_text(text_image(["NOTE"]).resize((32, 16))))
        self.assertFalse(raster_text(Image.new("L", (9000, 20), "white")))
        self.assertFalse(raster_text(text_image(["I"])))
