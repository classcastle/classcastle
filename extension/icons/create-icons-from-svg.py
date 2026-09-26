#!/usr/bin/env python3
"""
Create PNG icons from SVG using cairosvg
Install with: pip install cairosvg
"""

import cairosvg
from pathlib import Path

# Create icons directory
icons_dir = Path('icons')
icons_dir.mkdir(exist_ok=True)

# SVG file
svg_file = icons_dir / 'icon.svg'

# Convert to different sizes
sizes = [16, 48, 128]

for size in sizes:
    output_file = icons_dir / f'icon{size}.png'
    try:
        cairosvg.svg2png(
            url=str(svg_file),
            write_to=str(output_file),
            output_width=size,
            output_height=size
        )
        print(f"Created {output_file}")
    except Exception as e:
        print(f"Error creating {output_file}: {e}")
        print("Install cairosvg with: pip install cairosvg")
