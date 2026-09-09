# PokéQueer

Rate Pokémon on a spectrum from straight to gay, one at a time, then see how your
rating compares to everyone else who's run this app.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd pokequeer
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

That's it — no database to set up, no API keys.

## How it works

- **Frontend**: plain HTML/CSS/JS in `public/`, styled as a little handheld device.
- **Backend**: a small Express server (`server.js`) with three jobs:
  1. Hand out a Pokémon you haven't rated yet (`GET /api/next`)
  2. Save your rating and return the community average (`POST /api/rate`)
  3. Serve a leaderboard of the "gayest" and "straightest" Pokémon by community
     average (`GET /api/leaderboard`)
- **Storage**: ratings are saved to a plain JSON file at `data/db.json`. Delete
  that file any time to wipe all ratings and start over. There's no login —
  each browser gets a random anonymous ID (stored in `localStorage`) so it can
  remember what you've already rated.
- **Pokémon list & art**: on first run, the server tries to fetch the full,
  current Pokédex from [PokeAPI](https://pokeapi.co) and caches it to
  `data/pokemon-list.json`. If that fails (e.g. you're offline), it falls back
  to a bundled list of the original 151 Pokémon (`pokemon-gen1.json`) so the
  app still works. Sprites are loaded directly from PokeAPI's public sprite
  repository on GitHub, so no API key is ever needed.
- **Order**: Pokémon are shown in ascending Pokédex number (so generation by
  generation), not randomly.
- **Back button**: lets you revisit and change your rating for anything you've
  rated so far *this session*. It's client-side history, so it resets if you
  reload the page — going back further than that isn't supported.
- **Skip baby Pokémon**: a toggle (saved in your browser) that excludes a
  curated set of "child-coded" Pokémon from the rotation — the 19 official
  Baby Pokémon (Pichu, Cleffa, Togepi, Riolu, etc.), a further ~19 Pokémon
  that read as cute/childlike by design (Eevee, Skitty, Emolga, Dedenne,
  Applin, Wooloo...), and every generation's first-stage starter (Bulbasaur/
  Charmander/Squirtle through Sprigatito/Fuecoco/Quaxly) — 65 Pokémon total.
  This list is a judgment call, not an official classification; the full set
  is in `BABY_POKEMON_IDS` near the top of `server.js` if you want to add,
  remove, or trim it. Toggling it only affects Pokémon fetched from that
  point on, not ones already in your session history.

## Hosting it on Render (so anyone can use it)

1. **Push this folder to a GitHub repo.**
   ```bash
   cd pokequeer
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Create a new repo on GitHub, then follow its instructions to push
   (`git remote add origin ...` and `git push -u origin main`).

2. **Create a Render account** at [render.com](https://render.com) and
   connect your GitHub account.

3. **New → Web Service**, pick your `pokequeer` repo.

4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Click **Create Web Service**. Render will build and deploy it, then give
   you a URL like `https://pokequeer.onrender.com` — that's live and
   shareable.

### Making ratings actually persist

Render's free instances use ephemeral disk: `data/db.json` will reset
whenever the service restarts or redeploys. Two ways to fix that, roughly in
order of effort:

- **Add a Render Disk** (a few dollars a month, cheapest is fine here):
  in your service's dashboard, go to **Disks → Add Disk**, give it a mount
  path (e.g. `/var/data`), then add an environment variable
  `DATA_DIR=/var/data` in **Environment**. Redeploy — ratings will now
  survive restarts.
- **Skip it for now**: on the free tier without a disk, ratings just reset
  occasionally (roughly whenever the service spins down from inactivity and
  wakes back up, or you redeploy). Fine for trying it out with friends;
  not fine for a permanent leaderboard.

Longer term, swapping the JSON file for a real database (Render offers a
free-tier Postgres) removes this problem entirely and scales better if the
site gets real traffic — happy to help with that migration whenever you're
ready.

### Also note

Render's free web services spin down after ~15 minutes of no traffic and
take 30–60 seconds to wake back up on the next visit. That's normal on the
free tier — upgrading to a paid instance keeps it always-on.

## Ideas for extending it

- Swap the JSON file for SQLite once you have real traffic.
- Add a "skip" button, or let people re-rate a Pokémon from a Pokémon detail page.
- Show a live distribution (histogram) instead of just the average.
- Filter the leaderboard by generation or type.
