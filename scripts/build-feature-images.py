"""Build the landing-page feature screenshots.

Source:  design/source-images/<original screenshots>   (drop new ones here; git-ignored)
Output:  src/assets/features/<slug>-<width>.webp (1280 and 720 wide, or less if the source is smaller)

Each slug below says which source file to use, which part of it to keep, and
which areas to blur (student names, join codes, live link tokens - the landing
page is public). Output is padded to 16:10 with the screenshot's own page
colour so every slide has the same frame. The landing page picks up whatever
exists in src/assets/features (see src/components/landing/featureSlides.ts),
so a slug with no output simply isn't shown.

Run:  python scripts/build-feature-images.py
Needs Pillow with WebP support (pip install pillow).
"""

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "source-images"  # git-ignored: originals contain unblurred PII
OUT = ROOT / "src" / "assets" / "features"
RATIO = 16 / 10
WIDTHS = (1280, 720)

# slug: source name prefixes (case-insensitive, first match wins),
#       crop box (left, top, right, bottom) in source pixels or None,
#       blur boxes in source pixels.
JOBS = {
    "institute-management": {
        "src": ["institute_manage", "institute-manage", "instiute_manage"],
        "crop": (395, 22, 1525, 728),
        "blur": [(1300, 366, 1428, 402)],  # teacher join code
    },
    "attendance": {
        "src": ["attendance1", "attendance"],
        "crop": (0, 0, 1528, 680),
        "blur": [],
    },
    "analytics": {
        "src": ["analytics"],
        "crop": (0, 0, 1014, 634),
        "blur": [],
    },
    "paper-checker": {
        "src": ["test_checker", "paper_checker", "paper-checker"],
        "crop": (800, 0, 1600, 445),
        "blur": [],
    },
    "assignments": {
        "src": ["assignment"],
        "crop": (0, 0, 1330, 823),
        "blur": [
            (190, 272, 445, 298),  # live upload-link token
            (44, 490, 228, 823),  # student names, roll numbers, guest ids
        ],
    },
    "calendar": {
        "src": ["calendar"],
        "crop": (0, 0, 985, 616),
        "blur": [],
    },
    # Features that exist but have no screenshot yet - drop a file named like
    # this into design/source-images and re-run.
    "live-contests": {"src": ["live_contest", "live-contest", "contest"], "crop": None, "blur": []},
    "leaderboard": {"src": ["leaderboard"], "crop": None, "blur": []},
}


def find_source(prefixes):
    files = [p for p in SRC.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    for prefix in prefixes:
        for f in sorted(files):
            if f.stem.lower().startswith(prefix):
                return f
    return None


def edge_colour(img):
    """Most common colour on the image border = the app's page background."""
    w, h = img.size
    px = [img.getpixel((x, 0)) for x in range(0, w, 7)]
    px += [img.getpixel((x, h - 1)) for x in range(0, w, 7)]
    px += [img.getpixel((0, y)) for y in range(0, h, 7)]
    px += [img.getpixel((w - 1, y)) for y in range(0, h, 7)]
    return max(set(px), key=px.count)


def pad_to_ratio(img):
    w, h = img.size
    if abs(w / h - RATIO) < 0.01:
        return img
    if w / h > RATIO:
        nw, nh = w, round(w / RATIO)
    else:
        nw, nh = round(h * RATIO), h
    canvas = Image.new("RGB", (nw, nh), edge_colour(img))
    canvas.paste(img, ((nw - w) // 2, (nh - h) // 2))
    return canvas


def build(slug, job):
    src = find_source(job["src"])
    if src is None:
        print(f"skip  {slug:22} (no source in {SRC.relative_to(ROOT)})")
        return
    img = Image.open(src).convert("RGB")
    for box in job["blur"]:
        region = img.crop(box).filter(ImageFilter.GaussianBlur(9))
        img.paste(region, box[:2])
    if job["crop"]:
        img = img.crop(job["crop"])
    img = pad_to_ratio(img)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob(f"{slug}-*.webp"):
        old.unlink()
    for w in sorted({min(width, img.width) for width in WIDTHS}):  # never upscale - it only adds blur
        out = img if w == img.width else img.resize((w, round(w / RATIO)), Image.LANCZOS)
        # light sharpening brings back UI text edges lost to JPEG + downscaling
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
        path = OUT / f"{slug}-{w}.webp"
        out.save(path, "WEBP", quality=86, method=6)
        print(f"wrote {path.relative_to(ROOT)}  {out.width}x{out.height}  {path.stat().st_size // 1024} KB  <- {src.name}")


if __name__ == "__main__":
    for slug, job in JOBS.items():
        build(slug, job)
