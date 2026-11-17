#!/usr/bin/env python3
"""Write the content editor's content into the site. See CMS.md.

  python3 tools/cms_apply.py export.json [assets_dir]

export.json holds the editor's documents as {"sections": {...}, "hero": {...},
"projects": [...], "services": [...], "testimonials": [...]}: the `data` of
cms/sections and cms/hero, and the `items` of the three lists.
assets_dir holds any newly uploaded files, named <asset id>.<ext>.

Media that already has a `file` is on the site and is left alone. Media with
an `asset` and no `file` is new: its file is copied to public/cms/ and the
entry gets that path. Prints the asset -> file pairs to write back to the editor.
"""
import json, pathlib, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
export = json.loads(pathlib.Path(sys.argv[1]).read_text())
assets = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
placed = {}


def place(m):
    """The site path (or link) for one media entry; None if it has nothing."""
    if not m:
        return None
    if m.get("file"):
        return m["file"]
    if m.get("url"):
        return m["url"]
    asset = m.get("asset")
    if not asset:
        return None
    found = sorted(assets.glob(asset + ".*")) if assets else []
    if not found:
        sys.exit(f"missing the file for asset {asset}: download it into the assets folder first")
    out = root / "public" / "cms" / found[0].name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(found[0], out)
    placed[asset] = "/cms/" + found[0].name
    return placed[asset]


def media(m):
    return {"kind": m["kind"], "src": place(m)}


look = export.get("hero") or {}
site = {
    "sections": {k: v is not False for k, v in (export.get("sections") or {}).items()},
    "hero": {"media": media(look["hero"]) if look.get("hero") else {"kind": "image", "src": "/figma/hero.png"}},
    "pricing": {k: place(look.get(k)) or "/figma/hero.png" for k in ("growth", "dedicated")},
    "projects": [{"id": p["id"], "title": p["title"].strip(), "tags": p["tags"].strip(), "media": media(p["media"])} for p in export["projects"]],
    "services": [{"id": s["id"], "name": s["name"].strip(), "media": media(s["media"])} for s in export["services"]],
    "testimonials": [
        {"id": t["id"], "quote": t["quote"].strip(), "name": t["name"].strip(), "role": t["role"].strip(), "photo": place(t.get("photo")), "video": place(t.get("video")),
         "media": bool(t["media"]) if t.get("media") is not None else bool(t.get("photo")), "hidden": bool(t.get("hidden"))}
        for t in export["testimonials"]
    ],
}
if len(site["projects"]) < 2 or len(site["services"]) < 2:
    sys.exit("the site needs at least two projects and two services")
(root / "src" / "content" / "site.json").write_text(json.dumps(site, indent=2, ensure_ascii=False) + "\n")
print(json.dumps(placed, indent=2))
