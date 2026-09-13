#!/usr/bin/env python3
"""Build Ava Reader's Cyrillic companions from the upstream Google Fonts TTFs.

Requirements: fonttools[woff] (tested with fonttools 4.65.0, brotli 1.2.0).
Usage: python build-cyrillic.py [source-directory] [output-directory]
Source files: nunito-sans.ttf and source-serif.ttf (see README.md).
"""
from pathlib import Path
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent
output.mkdir(parents=True, exist_ok=True)
# Preserve full available Cyrillic inventory, Cyrillic combining marks and Ukrainian hryvnia.
unicodes = set([0x0300, 0x0301, 0x0308, 0x20B4])
for start, end in [(0x0400, 0x052F), (0x1C80, 0x1C8A), (0x2DE0, 0x2DFF), (0xA640, 0xA69F), (0xFE2E, 0xFE2F)]:
    unicodes.update(range(start, end + 1))

for filename, axes, target in [
    ('nunito-sans.ttf', {'wght': (400, 700), 'wdth': 100, 'opsz': 12, 'YTLC': 480}, 'nunito-sans-cyrillic.woff2'),
    ('source-serif.ttf', {'wght': (400, 800), 'opsz': 20}, 'source-serif-4-cyrillic.woff2'),
]:
    font = TTFont(source / filename)
    instantiateVariableFont(font, axes, inplace=True)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(output / target)
    print(f'{target}: {(output / target).stat().st_size:,} bytes')
