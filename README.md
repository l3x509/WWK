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
