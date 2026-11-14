import zlib
import struct
import math
import os

def create_png(width, height, get_pixel_func):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter byte: None
        for x in range(width):
            r, g, b, a = get_pixel_func(x, y, width, height)
            raw_data.extend((r, g, b, a))
            
    def make_chunk(chunk_type, data):
        length = len(data)
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack(">I", length) + chunk_type + data + struct.pack(">I", crc)

    png_bytes = bytearray(b"\x89PNG\r\n\x1a\n")
    # IHDR
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png_bytes.extend(make_chunk(b"IHDR", ihdr_data))
    # IDAT
    compressed = zlib.compress(bytes(raw_data), 9)
    png_bytes.extend(make_chunk(b"IDAT", compressed))
    # IEND
    png_bytes.extend(make_chunk(b"IEND", b""))
    return bytes(png_bytes)

def render_islamic_icon(x, y, width, height, is_maskable=False):
    # Normalize coordinates -1 to 1
    nx = (x / (width - 1)) * 2 - 1
    ny = (y / (height - 1)) * 2 - 1

    # Safe zone scaling for maskable icons (scale down by 0.75 so content fits inside central 80%)
    scale = 0.72 if is_maskable else 0.88
    sx = nx / scale
    sy = ny / scale

    # Background gradient: Midnight Blue (#0a1128) to Forest Emerald (#064e3b) to Dark Teal (#042f2e)
    # Radial distance from top-center
    rad = math.sqrt((nx)**2 + (ny + 0.3)**2)
    t = min(max(rad / 1.5, 0.0), 1.0)
    
    # Base background color
    bg_r = int(10 * (1 - t) + 4 * t)
    bg_g = int(78 * (1 - t) + 47 * t)
    bg_b = int(59 * (1 - t) + 46 * t)
    
    # Distance from center
    dist = math.sqrt(sx**2 + sy**2)

    # Golden Decorative Rings
    is_gold_ring = (0.88 <= dist <= 0.92) or (0.80 <= dist <= 0.82)
    if is_gold_ring:
        return (217, 119, 6, 255) # Amber gold

    # Arch (Mihrab)
    # y ranges from -0.8 to 0.7
    in_arch = False
    arch_width = 0.65
    if -0.7 <= sy <= 0.65 and abs(sx) <= arch_width:
        # Arch top curve
        arch_top = -0.7 + (sx / arch_width)**2 * 0.4
        if sy >= arch_top:
            in_arch = True

    # Mihrab outline
    on_arch_border = False
    if abs(abs(sx) - arch_width) < 0.02 and -0.7 <= sy <= 0.65:
        on_arch_border = True
    arch_curve_y = -0.7 + (sx / arch_width)**2 * 0.4
    if abs(sy - arch_curve_y) < 0.025 and abs(sx) <= arch_width:
        on_arch_border = True

    # Crescent Moon
    # Center around (0, -0.32), radius 0.22
    cx, cy = 0.0, -0.30
    cdist1 = math.sqrt((sx - cx)**2 + (sy - cy)**2)
    cdist2 = math.sqrt((sx - (cx + 0.06))**2 + (sy - (cy - 0.04))**2)
    in_crescent = (cdist1 <= 0.20 and cdist2 >= 0.17)

    # Star
    s_dist = math.sqrt((sx - 0.04)**2 + (sy + 0.30)**2)
    in_star = (s_dist <= 0.04)

    # Open Quran Pages
    # Center at (0, 0.15)
    in_book = False
    in_lines = False
    
    # Left page: polygon
    # Spine is at sx=0, sy=0.0 to 0.38
    if -0.55 <= sx <= 0 and 0.05 <= sy <= 0.42:
        # Tilt and curve
        baseline = 0.05 + 0.12 * abs(sx)
        topline = 0.38 + 0.08 * abs(sx)
        if baseline <= sy <= topline:
            in_book = True
            # Lines of script
            for line_y in [0.15, 0.22, 0.29, 0.36]:
                if abs(sy - (line_y + 0.09 * abs(sx))) < 0.012 and -0.48 <= sx <= -0.06:
                    in_lines = True

    # Right page
    if 0 <= sx <= 0.55 and 0.05 <= sy <= 0.42:
        baseline = 0.05 + 0.12 * abs(sx)
        topline = 0.38 + 0.08 * abs(sx)
        if baseline <= sy <= topline:
            in_book = True
            for line_y in [0.15, 0.22, 0.29, 0.36]:
                if abs(sy - (line_y + 0.09 * abs(sx))) < 0.012 and 0.06 <= sx <= 0.48:
                    in_lines = True

    # Book Spine
    in_spine = (abs(sx) <= 0.02 and 0.04 <= sy <= 0.44)

    # Wooden Rihal (Stand) under Quran
    in_stand = False
    if 0.40 <= sy <= 0.65:
        # Cross shape: y - 0.40 = |sx| * 0.8
        stand_diag = abs(abs(sy - 0.42) - abs(sx) * 0.7)
        if stand_diag < 0.035 and abs(sx) <= 0.40:
            in_stand = True
        if abs(sx) <= 0.03 and 0.40 <= sy <= 0.60:
            in_stand = True

    # Colors
    if in_star or in_crescent:
        return (251, 191, 36, 255) # Radiant Gold
    if in_spine:
        return (180, 83, 9, 255) # Dark amber
    if in_lines:
        return (5, 150, 105, 255) # Emerald Quranic ink
    if in_book:
        return (248, 250, 252, 255) # Parchment white
    if in_stand:
        return (217, 119, 6, 255) # Wood gold
    if on_arch_border:
        return (245, 158, 11, 255) # Gold border
    if in_arch:
        # Glowing inner arch
        glow_r = int(bg_r * 0.8 + 20)
        glow_g = int(bg_g * 0.8 + 40)
        glow_b = int(bg_b * 0.8 + 30)
        return (glow_r, glow_g, glow_b, 255)

    return (bg_r, bg_g, bg_b, 255)

os.makedirs('public', exist_ok=True)

# Generate 192x192
print("Generating pwa-192x192.png...")
png_192 = create_png(192, 192, lambda x, y, w, h: render_islamic_icon(x, y, w, h, False))
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(png_192)

# Generate 512x512
print("Generating pwa-512x512.png...")
png_512 = create_png(512, 512, lambda x, y, w, h: render_islamic_icon(x, y, w, h, False))
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(png_512)

# Generate 512x512 maskable (with 15% safe-zone margin)
print("Generating pwa-maskable-512x512.png...")
png_maskable = create_png(512, 512, lambda x, y, w, h: render_islamic_icon(x, y, w, h, True))
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(png_maskable)

# Generate 180x180 apple-touch-icon
print("Generating apple-touch-icon.png...")
png_apple = create_png(180, 180, lambda x, y, w, h: render_islamic_icon(x, y, w, h, False))
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(png_apple)

# Generate favicon.ico (copy 192 or standard header)
# Minimal valid ICO containing PNG data
ico_data = bytearray()
ico_data.extend(struct.pack("<HHH", 0, 1, 1)) # reserved, type=1 (ico), 1 image
# Directory entry: width=0 (means 256 or 192), height=0, colors=0, reserved=0, planes=1, bpp=32, size, offset
ico_data.extend(struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_192), 22))
ico_data.extend(png_192)
with open('public/favicon.ico', 'wb') as f:
    f.write(ico_data)

print("All PWA icons generated successfully!")
