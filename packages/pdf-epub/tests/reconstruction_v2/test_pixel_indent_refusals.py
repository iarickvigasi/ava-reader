"""Non-text, clipped and decoration-only ink cannot establish source paragraph indentation."""

import unittest

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.reconstruction_v2.pixel_line_margins import pixel_line_margins


class PixelIndentRefusals(unittest.TestCase):
    def text(self):
        image = Image.new("L", (350, 80), 255)
        draw = ImageDraw.Draw(image)
        font = ImageFont.load_default(size=14)
        for y in (10, 40):
            draw.text((20, y), "Several printed words form a source line.", font=font, fill=0)
        return image

    def test_scaled_printed_text_has_independent_complete_margins(self):
        for scale in (1, 2, 3):
            image = self.text().resize((350 * scale, 80 * scale), Image.Resampling.NEAREST)
            margins = pixel_line_margins(image, scale)
            self.assertEqual(2, len(margins))
            self.assertEqual(margins[0], margins[1])

    def test_solid_background_artwork_and_underline_only_stay_unknown(self):
        black = Image.new("L", (350, 80), 0)
        artwork = Image.new("L", (350, 80), 255)
        draw = ImageDraw.Draw(artwork)
        for y in (10, 40):
            draw.rectangle((20, y, 250, y + 10), fill=0)
        underline = Image.new("L", (350, 80), 255)
        ImageDraw.Draw(underline).line((20, 20, 300, 20), fill=0, width=2)
        for image in (black, artwork, underline):
            self.assertEqual([], pixel_line_margins(image, 1))

    def test_side_rule_and_both_horizontal_crop_edges_stay_unknown(self):
        rule = self.text()
        ImageDraw.Draw(rule).line((10, 0, 10, 79), fill=0, width=1)
        self.assertEqual([], pixel_line_margins(rule, 1))
        text = self.text()
        bounds = text.convert("L").point(lambda v: 255 if v < 150 else 0).getbbox()
        for crop in (
            (bounds[0], 0, 350, 80),
            (0, 0, bounds[2], 80),
            (0, bounds[1], 350, 80),
            (0, 0, 350, bounds[3]),
        ):
            self.assertEqual([], pixel_line_margins(text.crop(crop), 1))
