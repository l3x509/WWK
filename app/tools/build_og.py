#!/usr/bin/env python3
"""Generate a 1200x630 share image per blog post (public/og/<slug>.png) from its og:title,
and point og:image / twitter:image at it. Re-run after adding or retitling a post:
  python3 tools/build_og.py            (needs playwright + chromium)"""
import html, re, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"
SITE = "https://watchwithkids.com"
ICONS = [("halloween", "🎃"), ("bedtime", "🌙"), ("rainy", "🌧️"), ("netflix", "🎬"), ("amazon", "📦"), ("disney", "🏰"),
         ("screen-time", "⏱️"), ("ratings", "🔎"), ("siblings", "👫"), ("spider", "🕷️"), ("toy-story", "🤠"), ("moana", "🌊"),
         ("shows", "📺"), ("year-old", "🍿"), ("parents", "🛋️"), ("new-family", "✨")]

def icon(slug):
    for k, e in ICONS:
        if k in slug: return e
    return "🍿"

def card(title, emoji):
    t = html.escape(title)
    size = 74 if len(title) <= 40 else 62 if len(title) <= 62 else 52
    return f"""<html><body style="margin:0;width:1200px;height:630px;background:radial-gradient(circle at 85% 15%,#2a1d05 0,#0a0a14 55%);font-family:'DM Sans',Arial,sans-serif;color:#fafafa;box-sizing:border-box;padding:70px 90px;display:flex;flex-direction:column;overflow:hidden;position:relative">
<div style="font-family:Georgia,serif;font-weight:900;font-size:38px">WatchWith<span style="color:#f59e0b">Kids</span></div>
<div style="margin-top:14px;display:inline-block;align-self:flex-start;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#f59e0b;border:2px solid #f59e0b66;border-radius:100px;padding:6px 18px">Family movie guide</div>
<div style="flex:1;display:flex;align-items:center;max-width:860px"><div style="font-family:Georgia,serif;font-weight:900;font-size:{size}px;line-height:1.12">{t}</div></div>
<div style="font-size:26px;color:#9696b0;letter-spacing:.08em">watchwithkids.com</div>
<div style="position:absolute;right:70px;top:210px;font-size:170px">{emoji}</div></body></html>"""

def main():
    (ROOT / "og").mkdir(exist_ok=True)
    posts = sorted((ROOT / "blog").glob("*.html"))
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1200, "height": 630})
        for f in posts:
            src = f.read_text(encoding="utf-8")
            m = re.search(r'<meta property="og:title"\s+content="([^"]+)"', src)
            title = html.unescape(m.group(1)) if m else f.stem
            title = re.sub(r"\s*[—|-]\s*WatchWithKids.*$", "", title).strip()
            pg.set_content(card(title, icon(f.stem)))
            pg.screenshot(path=str(ROOT / "og" / f"{f.stem}.png"))
            url = f"{SITE}/og/{f.stem}.png"
            src = re.sub(r'(<meta property="og:image"\s+content=")[^"]*(")', rf'\g<1>{url}\2', src, count=1)
            if 'name="twitter:image"' in src:
                src = re.sub(r'(<meta name="twitter:image"\s+content=")[^"]*(")', rf'\g<1>{url}\2', src, count=1)
            else:
                src = re.sub(r'(<meta property="og:image"[^>]*/>)', r'\1\n  <meta name="twitter:image"       content="' + url + '"/>', src, count=1)
            if 'property="og:image:width"' not in src:
                src = re.sub(r'(<meta property="og:image"[^>]*/>)', r'\1\n  <meta property="og:image:width"  content="1200"/>\n  <meta property="og:image:height" content="630"/>', src, count=1)
            f.write_text(src, encoding="utf-8")
            print(f.stem, "->", title)
        b.close()

if __name__ == "__main__":
    main()
