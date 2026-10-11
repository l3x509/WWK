#!/usr/bin/env python3
"""Injects a 'Related guides' block into every article and a 'More guides' list on the homepage.
Idempotent: re-running replaces the previous block. Run from app/:  python3 tools/add_related_guides.py
"""
import pathlib, re, html, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from guides import GUIDES, RELATED
APP = pathlib.Path(__file__).resolve().parent.parent
PUB = APP / "public"
CSS = """/* wwk-related */
.related-guides{margin:44px 0 8px;padding-top:28px;border-top:1px solid #1a1a2e}
.related-guides h2{font-family:'Playfair Display',serif;font-size:22px;color:#fff;margin:0 0 14px}
.related-guides ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.related-guides a{display:block;background:#10101e;border:1px solid #1a1a2e;border-radius:12px;padding:13px 16px;color:#fafafa;text-decoration:none;font-size:15px;line-height:1.4}
.related-guides a:hover{border-color:rgba(245,158,11,.35)}
.related-guides small{display:block;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;color:#f59e0b;text-transform:uppercase;margin-bottom:3px}
.related-cta{margin-top:14px;font-size:14px;color:#c8c8de}.related-cta a{display:inline;border:0;background:none;padding:0;color:#f59e0b}
"""
def block(slug):
    items = "".join(f'<li><a href="/blog/{s}"><small>{html.escape(GUIDES[s][1])}</small>{html.escape(GUIDES[s][0])}</a></li>' for s in RELATED[slug])
    return ('<!--wwk-related-start-->\n<aside class="related-guides" aria-label="Related guides">\n<h2>Keep reading</h2>\n<ul>'
            + items + '</ul>\n<p class="related-cta">Not sure what to pick tonight? <a href="/">Use the free movie finder →</a> · <a href="/blog">All guides</a></p>\n</aside>\n<!--wwk-related-end-->\n')
n = 0
for slug in RELATED:
    f = PUB / "blog" / f"{slug}.html"
    if not f.exists(): print("skip (no file):", slug); continue
    t = f.read_text()
    t = re.sub(r"<!--wwk-related-start-->.*?<!--wwk-related-end-->\n?", "", t, flags=re.S)
    if "/* wwk-related */" not in t:
        t = t.replace("</style>", CSS + "</style>", 1)
    marker = "<!--wwk-signup-->"
    if marker in t: t = t.replace(marker, block(slug) + marker, 1)
    else: t = t.replace("</article>", block(slug) + "</article>", 1)
    f.write_text(t); n += 1
print("articles updated:", n)

# Homepage: full guide index (grouped) under the Popular guides grid.
idx = PUB / "index.html"
t = idx.read_text()
groups = {}
for s, (title, g) in GUIDES.items(): groups.setdefault(g, []).append((s, title))
rows = "".join(f'<div class="all-guides-group"><span>{html.escape(g)}</span>' + " · ".join(f'<a href="/blog/{s}">{html.escape(ti)}</a>' for s, ti in v) + '</div>' for g, v in groups.items())
new = ('<!--wwk-allguides-start-->\n<div class="all-guides"><h3>Every guide</h3>' + rows + '</div>\n<!--wwk-allguides-end-->\n')
t = re.sub(r"<!--wwk-allguides-start-->.*?<!--wwk-allguides-end-->\n?", "", t, flags=re.S)
css = """    /* wwk-allguides */
    .all-guides{max-width:940px;margin:28px auto 0;padding:0 0 4px}
    .all-guides h3{font-family:var(--font-display);font-size:18px;color:#fff;margin-bottom:12px}
    .all-guides-group{font-size:14px;line-height:1.9;color:#c8c8de;margin-bottom:6px}
    .all-guides-group span{display:inline-block;min-width:96px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#f59e0b;margin-right:8px}
    .all-guides-group a{color:#fafafa;text-decoration:none;border-bottom:1px solid rgba(245,158,11,.35)}
    .all-guides-group a:hover{color:#f59e0b}
"""
if "/* wwk-allguides */" not in t: t = t.replace("    .guides-grid {", css + "    .guides-grid {", 1)
t = t.replace("  </div>\n</section>\n\n<!-- ── SEO CONTENT", "  </div>\n" + new + "</section>\n\n<!-- ── SEO CONTENT", 1)
assert "wwk-allguides-start" in t
idx.write_text(t); print("homepage updated")
