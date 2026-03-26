"""
Generate portal image variations from the original pio.jpg
Range: subtle light effects → bold artistic treatments → textured/painterly
Output: ~1200px wide JPGs to match existing portal sizes
"""
from PIL import Image, ImageFilter, ImageEnhance, ImageOps, ImageDraw
import numpy as np
import os

SRC = "assets/pio.jpg"
OUT = "assets"
START_INDEX = 7
TARGET_W = 1264  # match existing portals

img_full = Image.open(SRC).convert("RGB")
# Resize to target width
ratio = TARGET_W / img_full.width
TARGET_H = int(img_full.height * ratio)
img = img_full.resize((TARGET_W, TARGET_H), Image.LANCZOS)
w, h = img.size
arr = np.array(img, dtype=np.float64)

results = []

# --- 1. WARM GOLDEN HOUR — subtle warm light wash ---
def warm_golden():
    a = arr.copy()
    a[:,:,0] = np.clip(a[:,:,0] * 1.15 + 15, 0, 255)
    a[:,:,1] = np.clip(a[:,:,1] * 1.05 + 5, 0, 255)
    a[:,:,2] = np.clip(a[:,:,2] * 0.75, 0, 255)
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.15)
    out = out.filter(ImageFilter.GaussianBlur(radius=0.8))
    return out

results.append(("Warm golden hour", warm_golden()))

# --- 2. COOL MOONLIGHT — cold blue/silver tone ---
def cool_moonlight():
    a = arr.copy()
    a[:,:,0] = np.clip(a[:,:,0] * 0.65, 0, 255)
    a[:,:,1] = np.clip(a[:,:,1] * 0.75 + 10, 0, 255)
    a[:,:,2] = np.clip(a[:,:,2] * 1.35 + 25, 0, 255)
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Brightness(out).enhance(0.7)
    out = ImageEnhance.Contrast(out).enhance(1.35)
    return out

results.append(("Cool moonlight", cool_moonlight()))

# --- 3. HIGH CONTRAST B&W — dramatic monochrome ---
def bw_dramatic():
    out = ImageOps.grayscale(img)
    out = ImageEnhance.Contrast(out).enhance(1.8)
    out = ImageEnhance.Brightness(out).enhance(0.85)
    grain = np.random.normal(0, 12, (h, w)).astype(np.float64)
    a = np.array(out, dtype=np.float64) + grain
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return out.convert("RGB")

results.append(("Dramatic B&W", bw_dramatic()))

# --- 4. SOFT B&W — gentle, low contrast, vintage ---
def bw_soft():
    out = ImageOps.grayscale(img)
    out = ImageEnhance.Contrast(out).enhance(0.6)
    out = ImageEnhance.Brightness(out).enhance(1.1)
    a = np.array(out, dtype=np.float64)
    rgb = np.stack([
        np.clip(a + 8, 0, 255),
        np.clip(a + 2, 0, 255),
        np.clip(a - 5, 0, 255)
    ], axis=-1)
    out = Image.fromarray(rgb.astype(np.uint8))
    out = out.filter(ImageFilter.GaussianBlur(radius=0.5))
    return out

results.append(("Soft B&W", bw_soft()))

# --- 5. SOLARIZED ---
def solarized():
    a = arr.copy()
    mask = a > 128
    a[mask] = 255 - a[mask]
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Color(out).enhance(1.4)
    out = ImageEnhance.Contrast(out).enhance(1.2)
    return out

results.append(("Solarized", solarized()))

# --- 6. OIL PAINT EFFECT — heavy painterly ---
def oil_paint():
    out = img.copy()
    out = out.filter(ImageFilter.MedianFilter(size=7))
    out = out.filter(ImageFilter.MedianFilter(size=5))
    out = out.filter(ImageFilter.MedianFilter(size=3))
    out = ImageEnhance.Color(out).enhance(1.6)
    out = ImageEnhance.Contrast(out).enhance(1.25)
    out = out.filter(ImageFilter.EDGE_ENHANCE_MORE)
    return out

results.append(("Oil paint", oil_paint()))

# --- 7. POSTERIZED — graphic, reduced palette ---
def posterized():
    a = arr.copy()
    levels = 4
    a = (a // (256 // levels)) * (256 // levels)
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Color(out).enhance(1.8)
    out = ImageEnhance.Contrast(out).enhance(1.1)
    return out

results.append(("Posterized", posterized()))

# --- 8. CROSS PROCESSED — analog darkroom color shift ---
def cross_process():
    a = arr.copy()
    r = np.clip(a[:,:,0] * 1.15 + 10, 0, 255)
    g = np.clip(128 + (a[:,:,1] - 128) * 1.5, 0, 255)
    b = np.clip(a[:,:,2] * 0.65 + 35, 0, 255)
    a[:,:,0] = r; a[:,:,1] = g; a[:,:,2] = b
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.2)
    return out

results.append(("Cross processed", cross_process()))

# --- 9. EMBOSSED TEXTURE — sculptural relief ---
def embossed():
    emb = img.filter(ImageFilter.EMBOSS)
    a_orig = arr.copy()
    a_emb = np.array(emb, dtype=np.float64)
    blended = np.clip(a_orig * 0.45 + a_emb * 0.55, 0, 255)
    out = Image.fromarray(blended.astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.6)
    return out

results.append(("Embossed texture", embossed()))

# --- 10. INFRARED — false color ---
def infrared():
    a = arr.copy()
    r = np.clip(a[:,:,1] * 1.3 + 30, 0, 255)
    g = np.clip(a[:,:,0] * 0.5, 0, 255)
    b = np.clip(a[:,:,2] * 0.35, 0, 255)
    a[:,:,0] = r; a[:,:,1] = g; a[:,:,2] = b
    out = Image.fromarray(a.astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.3)
    return out

results.append(("Infrared", infrared()))

# --- 11. SEPIA VINTAGE ---
def sepia():
    grey = np.array(ImageOps.grayscale(img), dtype=np.float64)
    r = np.clip(grey * 1.08 + 20, 0, 255)
    g = np.clip(grey * 0.88 + 10, 0, 255)
    b = np.clip(grey * 0.65, 0, 255)
    rgb = np.stack([r, g, b], axis=-1)
    grain = np.random.normal(0, 8, (h, w, 3))
    out = Image.fromarray(np.clip(rgb + grain, 0, 255).astype(np.uint8))
    return out

results.append(("Sepia vintage", sepia()))

# --- 12. NEON GLOW — dark with edge glow ---
def neon_glow():
    edges = img.filter(ImageFilter.FIND_EDGES)
    a_edges = np.array(edges, dtype=np.float64)
    a_edges[:,:,0] = np.clip(a_edges[:,:,0] * 2.5, 0, 255)
    a_edges[:,:,1] = np.clip(a_edges[:,:,1] * 1.8, 0, 255)
    a_edges[:,:,2] = np.clip(a_edges[:,:,2] * 3.0, 0, 255)
    dark = arr.copy() * 0.15
    combined = np.clip(dark + a_edges, 0, 255)
    out = Image.fromarray(combined.astype(np.uint8))
    # Slight blur for glow
    glow = out.filter(ImageFilter.GaussianBlur(radius=2))
    a_glow = np.array(glow, dtype=np.float64)
    a_sharp = np.array(out, dtype=np.float64)
    final = np.clip(a_glow * 0.5 + a_sharp * 0.6, 0, 255)
    return Image.fromarray(final.astype(np.uint8))

results.append(("Neon glow", neon_glow()))

# --- 13. DUOTONE TEAL/ORANGE ---
def duotone():
    grey = np.array(ImageOps.grayscale(img), dtype=np.float64) / 255.0
    r = np.clip(grey * 230 + (1 - grey) * 0, 0, 255)
    g = np.clip(grey * 180 + (1 - grey) * 80, 0, 255)
    b = np.clip(grey * 120 + (1 - grey) * 100, 0, 255)
    out = Image.fromarray(np.stack([r, g, b], axis=-1).astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.2)
    return out

results.append(("Duotone teal/orange", duotone()))

# --- 14. HEAVY GRAIN TEXTURE ---
def heavy_grain():
    out = ImageEnhance.Color(img).enhance(0.4)
    out = ImageEnhance.Contrast(out).enhance(1.5)
    a = np.array(out, dtype=np.float64)
    grain = np.random.normal(0, 28, (h, w, 3))
    out = Image.fromarray(np.clip(a + grain, 0, 255).astype(np.uint8))
    return out

results.append(("Heavy grain", heavy_grain()))

# --- 15. DREAMY SOFT GLOW ---
def dreamy():
    blurred = img.filter(ImageFilter.GaussianBlur(radius=12))
    a_blur = np.array(blurred, dtype=np.float64)
    a_orig = arr.copy()
    screened = 255 - ((255 - a_orig) * (255 - a_blur)) / 255
    blended = np.clip(a_orig * 0.45 + screened * 0.55, 0, 255)
    out = Image.fromarray(blended.astype(np.uint8))
    out = ImageEnhance.Brightness(out).enhance(1.12)
    return out

results.append(("Dreamy glow", dreamy()))

# --- 16. PENCIL SKETCH ---
def pencil_sketch():
    grey = ImageOps.grayscale(img)
    inv = ImageOps.invert(grey)
    blurred = inv.filter(ImageFilter.GaussianBlur(radius=15))
    a_grey = np.array(grey, dtype=np.float64)
    a_blur = np.array(blurred, dtype=np.float64)
    with np.errstate(divide='ignore', invalid='ignore'):
        sketch = np.where(a_blur != 0, np.clip(a_grey * 256.0 / (256.0 - a_blur), 0, 255), 255)
    return Image.fromarray(sketch.astype(np.uint8)).convert("RGB")

results.append(("Pencil sketch", pencil_sketch()))

# --- Save all as JPG ---
for i, (name, result) in enumerate(results):
    idx = START_INDEX + i
    path = os.path.join(OUT, f"portal-{idx}.jpg")
    result.save(path, "JPEG", quality=82, optimize=True)
    size_kb = os.path.getsize(path) / 1024
    print(f"Saved portal-{idx}.jpg — {name} ({size_kb:.0f}KB)")

print(f"\nGenerated {len(results)} portal images (portal-{START_INDEX} to portal-{START_INDEX + len(results) - 1})")
