# WatchWithKids

Node/Express app: static pages in `public/`, plus a locked-down TMDb proxy at `/api/tmdb/*`.

## Run locally
    cp .env.example .env   # add your TMDB_API_KEY
    npm install
    npm start

## Deploy (Hostinger Node.js + GitHub)
- Entry file: `server.js`, start command `npm start`, Node 18+.
- Set `TMDB_API_KEY` in the hosting environment variables. Never commit it.
- Push to the deploy branch to auto-deploy.

## Adding an article
1. Add `public/blog/<slug>.html` (served at `/blog/<slug>`).
2. Add a card in `public/blog.html` and the URL in `public/sitemap.xml`.
3. `python3 tools/add_signup_block.py public/blog` adds the email signup block (safe to re-run).

## Not in the repo
`public/og-image.png` — copy the existing file from the live site (Hostinger File Manager → `public/og-image.png`).
