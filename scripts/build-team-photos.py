"""Build the About page team portraits.

Source:  design/source-images/<file> (git-ignored) or public/images/<file>
Output:  src/assets/team/<slug>-320.webp and <slug>-640.webp (square, face-centred)

The About page (src/pages/AboutPage.tsx) shows a portrait only when its WebP
exists; otherwise it shows the person's initials. To add Nitin's or Durgesh's
photo: put it in design/source-images named nitin*.jpg / durgesh*.jpg (any
image type) and run:  python scripts/build-team-photos.py
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [ROOT / "design" / "source-images", ROOT / "public" / "images"]
OUT = ROOT / "src" / "assets" / "team"
SIZES = (320, 640)
BUDGET_KB = 40

# slug: file-name prefixes to look for (case-insensitive, first match wins)
JOBS = {
    "tarun-kumar-pathak": ["tarun"],
    "yash-dubey": ["yash"],
    "aakash-singh": ["aakash"],
    "nitin-kumar": ["nitin"],
    "durgesh": ["durgesh"],
    "aman-singh": ["aman"],
}


def find(prefixes):
    for folder in SOURCES:
        if not folder.exists():
            continue
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and any(
                f.stem.lower().startswith(p) for p in prefixes
            ):
                return f
    return None


def build(slug, prefixes):
    src = find(prefixes)
    if not src:
        print(f"skip  {slug:20} (no photo yet — initials are shown)")
        return
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    side = min(img.size)
    # centre horizontally, keep the top (faces sit in the upper part of portraits)
    left = (img.width - side) // 2
    img = img.crop((left, 0, left + side, side))
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        out_img = img.resize((size, size), Image.LANCZOS)
        path = OUT / f"{slug}-{size}.webp"
        for q in (82, 74, 66, 58):  # step quality down until it fits the budget
            out_img.save(path, "WEBP", quality=q, method=6)
            if path.stat().st_size <= BUDGET_KB * 1024:
                break
        print(f"wrote {path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB (q{q})  <- {src.name}")


if __name__ == "__main__":
    for slug, prefixes in JOBS.items():
        build(slug, prefixes)
