require("dotenv").config();
const express = require("express");
const fetch   = require("node-fetch");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;
// Tolerate stray whitespace/quotes pasted into the host's env-var field.
const KEY  = (process.env.TMDB_API_KEY || "").trim().replace(/^["']|["']$/g, "");
// TMDb has two credentials: a 32-char v3 "API Key" and a long JWT "Read Access Token" (starts with eyJ).
// Accept either one.
const IS_V4_TOKEN = KEY.startsWith("eyJ");

if (!KEY) {
  console.error("❌  TMDB_API_KEY is not set. Add it to .env or your host's environment variables.");
  process.exit(1);
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options",   "nosniff");
  res.setHeader("X-Frame-Options",          "SAMEORIGIN");
  res.setHeader("X-XSS-Protection",         "1; mode=block");
  res.setHeader("Referrer-Policy",          "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy",       "camera=(), microphone=(), geolocation=()");
  next();
});

// ── Allowed TMDb endpoint patterns ───────────────────────────────────────────
// Using patterns instead of exact strings so dynamic IDs (movie/123) are handled.
const ALLOWED_PATTERNS = [
  // Discovery + metadata
  /^discover\/(movie|tv)$/,
  /^configuration$/,
  /^genre\/(movie|tv)\/list$/,

  // Title detail, trailer videos, watch providers, age ratings
  /^(movie|tv)\/\d+$/,
  /^(movie|tv)\/\d+\/videos$/,
  /^(movie|tv)\/\d+\/watch\/providers$/,
  /^movie\/\d+\/release_dates$/,
  /^tv\/\d+\/content_ratings$/,
];

function isAllowedEndpoint(tmdbPath) {
  return ALLOWED_PATTERNS.some(p => p.test(tmdbPath));
}

// ── Allowed query param keys ──────────────────────────────────────────────────
const ALLOWED_PARAMS = new Set([
  // Core discover params
  "language", "sort_by", "include_adult", "page",
  "vote_count.gte", "vote_average.gte",
  "with_genres", "without_genres",
  "with_watch_providers", "watch_region",
  "with_runtime.lte", "with_runtime.gte",
  "with_runtime.lt",  "with_runtime.gt",

  // Age-based certification filter (fix #1 — youngest kid → cert cap)
  "certification_country", "certification.lte",

  // Avoid-filter params (crude humor keyword exclusion)
  "without_keywords",
]);

// ── Simple in-memory rate limit: 100 req/min per IP ──────────────────────────
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip  = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
              || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const rec = rateMap.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 60_000; }
  rec.count++;
  rateMap.set(ip, rec);
  if (rec.count > 100) return res.status(429).json({ error: "Too many requests." });
  next();
}

// ── Canonical URLs: no trailing slash, no /index.html ───────────────────────
app.use((req, res, next) => {
  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  if (req.path === "/index.html") return res.redirect(301, "/" + qs);
  if (req.path.length > 1 && req.path.endsWith("/") && !req.path.startsWith("/api/")) {
    return res.redirect(301, req.path.replace(/\/+$/, "") + qs);
  }
  next();
});

// ── Retired URLs → permanent redirects (keeps any inbound links/ranking) ────
const REDIRECTS = {
  "/blog/best-family-movies-this-weekend-may-2026": "/blog/new-family-movies-this-month",
};
app.use((req, res, next) => {
  const to = REDIRECTS[req.path];
  if (to) return res.redirect(301, to);
  next();
});

// ── Homepage (explicit, so "/" never depends on static index handling) ───────
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Clean blog URLs (sanitized slug) ─────────────────────────────────────────
app.get("/blog/:slug", (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
  const file = path.join(__dirname, "public", "blog", `${slug}.html`);
  res.sendFile(file, err => {
    if (err) res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  });
});

// ── Clean extensionless URLs (/about → public/about.html) ────────────────────
// Lets /about, /privacy, /contact resolve to their .html files in public/.
const fs = require("fs");
app.get(/^\/([a-z0-9-]+)$/i, (req, res, next) => {
  const name = req.params[0];
  const file = path.join(__dirname, "public", `${name}.html`);
  fs.access(file, fs.constants.F_OK, err => {
    if (err) return next();        // no matching page → fall through
    res.sendFile(file);
  });
});

// ── Serve static files ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── TMDb proxy (hardened) ─────────────────────────────────────────────────────
app.get("/api/tmdb/*", rateLimit, async (req, res) => {
  try {
    const tmdbPath = req.params[0];

    if (!isAllowedEndpoint(tmdbPath)) {
      return res.status(403).json({ error: "Endpoint not allowed." });
    }

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (ALLOWED_PARAMS.has(k)) query.set(k, String(v).slice(0, 200));
    }
    const headers = { Accept: "application/json" };
    if (IS_V4_TOKEN) headers.Authorization = `Bearer ${KEY}`;
    else query.set("api_key", KEY);

    const upstream = await fetch(
      `https://api.themoviedb.org/3/${tmdbPath}?${query}`,
      { timeout: 8000, headers }
    );
    if (upstream.status === 401) {
      console.error("TMDb rejected the credential (401). Check TMDB_API_KEY in the host's environment variables.");
    }
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("TMDb proxy error:", err.message);
    res.status(500).json({ error: "Upstream request failed." });
  }
});

// ── Catch-all → SPA ──────────────────────────────────────────────────────────
app.get("*", (_req, res) => {
  // Unknown URLs get a real 404 (not the homepage with a 200), so Google doesn't index soft-404s.
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => console.log(`🍿 WatchWithKids running on http://localhost:${PORT}`));
