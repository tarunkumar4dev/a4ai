"""Build the partner logos for the landing page.

Source:  design/source-images/<logo files>
Output:  src/assets/partners/<slug>.webp  (logo trimmed, on white, longest side 320 px)

The landing page lists partners in src/components/landing/Partners.tsx and shows
only those whose WebP exists. Run:  python scripts/build-partner-logos.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "source-images"  # git-ignored: originals contain unblurred PII
OUT = ROOT / "src" / "assets" / "partners"
SIZE = 320

# slug: source file, optional circle (cx, cy, r) to cut out of a photo background
JOBS = {
    "chanakya-institute": {"src": "CHANAKYA_ICON-removebg-preview.png"},
    "education-beast": {"src": "EB.jpeg"},
    "anupama-institute": {"src": "Anupama_Institute.jpeg"},
    "bright-line-institute": {"src": "BLI.jpeg"},
    # logo sits on a white disc over a blurred photo: keep the disc, drop the photo
    "physics-gram": {"src": "Physics_Gram.jpeg", "circle": (542, 386, 352), "pad": 0.2},
}


def on_white(img):
    img = img.convert("RGBA")
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    return Image.alpha_composite(bg, img).convert("RGB")


def trim(img, pad=0.06):
    """Crop to the non-white content, then add a small even margin."""
    diff = ImageChops.difference(img, Image.new("RGB", img.size, (255, 255, 255)))
    diff = diff.convert("L").point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox() or (0, 0, *img.size)
    img = img.crop(box)
    m = round(max(img.size) * pad)
    canvas = Image.new("RGB", (img.width + 2 * m, img.height + 2 * m), (255, 255, 255))
    canvas.paste(img, (m, m))
    return canvas


def build(slug, job):
    path = SRC / job["src"]
    if not path.exists():
        print(f"skip  {slug} (missing {path.name})")
        return
    img = Image.open(path)
    if "circle" in job:
        cx, cy, r = job["circle"]
        img = img.convert("RGBA")
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
        img.putalpha(mask)
    img = trim(on_white(img), job.get("pad", 0.06))
    scale = SIZE / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{slug}.webp"
    img.save(out, "WEBP", quality=90, method=6)
    print(f"wrote {out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for slug, job in JOBS.items():
        build(slug, job)
