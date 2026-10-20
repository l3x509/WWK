#!/usr/bin/env python3
"""Seed public/data/meters.json from the editorial ratings already published in the guides.

Sources of truth (our own editorial ratings, not scraped):
  - best-movies-for-8-year-olds.html : <table class="meter"> (Scary / Sad, Low/Medium/High)
  - best-halloween-movies-for-kids.html : Level 1/2/3 sections -> scare Low/Medium/High

Re-running MERGES into the existing file and never overwrites a hand-edited entry
(entries with "manual": true are kept as-is). Run from app/:  python3 tools/build_meters.py
"""
import re, json, html, os, unicodedata

LV = {"low": 0, "medium": 1, "high": 2}
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
OUT = os.path.join(PUB, "data", "meters.json")

def norm(t):
    t = html.unescape(t).lower().replace("&", "and")
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", t)

def read(p):
    return open(os.path.join(PUB, p), encoding="utf-8").read()

data = {"version": 1, "levels": ["Low", "Medium", "High"], "titles": {}}
if os.path.exists(OUT):
    data = json.load(open(OUT, encoding="utf-8"))
T = data["titles"]

def put(title, year, scare, sad, src):
    k = norm(title)
    cur = T.get(k, {})
    if cur.get("manual"):
        return
    rec = {"title": html.unescape(title).strip()}
    if year: rec["year"] = int(year)
    s = cur.get("scare") if scare is None else scare
    d = cur.get("sad") if sad is None else sad
    if s is not None: rec["scare"] = s
    if d is not None: rec["sad"] = d
    rec["src"] = sorted(set(cur.get("src", []) + [src]))
    T[k] = rec

# 1) guides with a <table class="meter"> (Film / Scary / Sad, then any extra columns)
for slug in ("best-movies-for-8-year-olds", "thanksgiving-movies-for-kids", "christmas-movies-for-kids"):
    s = read(f"blog/{slug}.html")
    for tr in re.findall(r'<tr><td>(.*?)</td><td class="lv-(\w+)">.*?</td><td class="lv-(\w+)">.*?</td></tr>', s):
        put(tr[0], None, LV[tr[1]], LV[tr[2]], slug)

# 2) Halloween levels (scare only)
s = read("blog/best-halloween-movies-for-kids.html")
for lvl, body in re.findall(r'<h2 id="level-(\d)">(.*?)(?=<h2 id="level-|<h2 id="(?!level)|$)', s, flags=re.S) or []:
    pass
parts = re.split(r'<h2 id="level-(\d)">', s)
for i in range(1, len(parts), 2):
    scare = int(parts[i]) - 1
    block = re.split(r'<h2 id="(?!level)', parts[i + 1])[0]
    for ft in re.findall(r'<div class="film-title">(.*?)</div>', block):
        m = re.match(r"(.*?)\s*\((\d{4})\)\s*$", html.unescape(ft))
        title, year = (m.group(1), m.group(2)) if m else (html.unescape(ft), None)
        put(title, year, scare, None, "best-halloween-movies-for-kids")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
n = len(T); both = sum(1 for v in T.values() if "scare" in v and "sad" in v)
print(f"{n} titles ({both} with both scary+sad) -> {os.path.relpath(OUT)}")
