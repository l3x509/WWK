# WatchWithKids

Node/Express app: static pages in `app/public/`, plus a locked-down TMDb proxy at `/api/tmdb/*`.

## Run locally
    cd app
    cp .env.example .env   # add your TMDB_API_KEY
    npm install
    npm start

## Deploy (Hostinger Node.js + GitHub)
- Root directory: `app` — entry file `server.js`, start command `npm start`, Node 18+.
- Set `TMDB_API_KEY` in the hosting environment variables. Never commit it.
- Push to the deploy branch to auto-deploy.

## Adding an article
1. Add `app/app/public/blog/<slug>.html` (served at `/blog/<slug>`).
2. Add a card in `app/app/public/blog.html` and the URL in `app/public/sitemap.xml`.
3. Run `python3 app/tools/add_signup_block.py app/public/blog` (email signup) and add the slug to `app/tools/guides.py`, then `python3 app/tools/add_related_guides.py` (related links + homepage guide list). Both are safe to re-run.

## Not in the repo
`app/public/og-image.png` — copy the existing file from the live site (Hostinger File Manager → `app/public/og-image.png`).

## Scare / Sad meters, runtimes, shortlists

- **Meters.** Every card shows Scary and Sad (Low / Medium / High). Our own editorial ratings live in
  `app/public/data/meters.json` (one entry per film, matched by normalized title + optional year) and are shown solid.
  Anything we have not rated is *estimated* from age rating, genre and TMDb themes and shown dashed with "(est.)".
  To rate more films: add entries to `meters.json` (set `"manual": true` so the builder never overwrites them), or add a
  meter table / Halloween-style levels to a guide and run `python3 tools/build_meters.py` from `app/`.
  Estimator rules are in `public/wwk-core.js` (`estimate`), covered by `npm test`.
- **Runtime + where to stream.** One TMDb call per card (`append_to_response`) returns runtime, age rating, themes and
  providers; the server caches those detail lookups for 6 hours. The homepage has a "Film length" filter (films only).
- **Shortlist sharing.** Saved titles -> "Share with co-parent" opens `/list?i=m550,t1399&n=Friday+night&v=Sam.uud~Alex.udu`.
  Everything (titles, name, votes) lives in the URL, so there is no database and no account. `m` = movie, `t` = show;
  votes: `u` yes, `d` no, `-` none. `/list` is `noindex` and not in the sitemap.
- GA4 events to mark as key events once they appear: `list_shared`, `list_opened`.

## Single-title lookup (`/title`)

Search any movie or show (autocomplete via `/api/tmdb/search/multi?query=`, cached server-side) and get: suggested starting age (derived from the scare/sad meters and US rating), per-age strip, runtime, where to stream (subscription / free / rent / buy, US), spoiler-hidden theme chips, trailer, save / vote-with-co-parent actions, a feedback button (`meter_feedback` GA event) and gentler recommendations.
`/title?id=m862` (movie) or `t1399` (show) is noindex; the bare `/title` page is indexable. Files: `public/title.html`, `public/wwk-search.js`, helpers in `public/wwk-core.js`.
Attribution: TMDB notice and JustWatch credit are shown on the page. Note TMDB's API terms limit free use to non-commercial projects, so check licensing while the site runs ads/affiliate links.
