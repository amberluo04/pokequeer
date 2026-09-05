const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Override with DATA_DIR env var to point at a persistent disk on your host
// (e.g. Render's mounted Disk path). Defaults to a local ./data folder.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const LIST_CACHE_PATH = path.join(DATA_DIR, 'pokemon-list.json');
const FALLBACK_LIST_PATH = path.join(__dirname, 'pokemon-gen1.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pokemonList = []; // [{ id, name }]
let db = { ratings: {} }; // ratings["<id>"] = [{ userId, rating }]

function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.ratings) db.ratings = {};
  } catch (e) {
    db = { ratings: {} };
  }
}

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

async function loadPokemonList() {
  // 1. Use a cached list from a previous run, if we have one.
  try {
    const cached = JSON.parse(fs.readFileSync(LIST_CACHE_PATH, 'utf8'));
    if (Array.isArray(cached) && cached.length > 0) {
      pokemonList = cached;
      console.log(`Loaded ${pokemonList.length} Pokémon from local cache.`);
      return;
    }
  } catch (e) {
    // no cache yet, fall through
  }

  // 2. Try to fetch the full, current Pokédex from PokeAPI.
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    if (!res.ok) throw new Error(`PokeAPI responded with ${res.status}`);
    const data = await res.json();
    const list = data.results
      .map((r) => {
        const match = r.url.match(/\/pokemon\/(\d+)\/?$/);
        const id = match ? parseInt(match[1], 10) : null;
        return id ? { id, name: r.name } : null;
      })
      .filter(Boolean);
    if (list.length === 0) throw new Error('PokeAPI returned an empty list');

    pokemonList = list;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LIST_CACHE_PATH, JSON.stringify(pokemonList, null, 2));
    console.log(`Fetched ${pokemonList.length} Pokémon from PokeAPI and cached them locally.`);
  } catch (e) {
    // 3. Offline, or PokeAPI unreachable: fall back to the bundled Gen 1 list.
    console.warn(`Could not reach PokeAPI (${e.message}). Falling back to the bundled Gen 1 list.`);
    pokemonList = JSON.parse(fs.readFileSync(FALLBACK_LIST_PATH, 'utf8'));
  }
}

function getStats(pokemonIdKey) {
  const ratings = db.ratings[pokemonIdKey] || [];
  const count = ratings.length;
  const average = count ? ratings.reduce((sum, r) => sum + r.rating, 0) / count : null;
  return { count, average };
}

// Pick the next Pokémon for this user to rate: prefer ones they haven't rated yet.
app.get('/api/next', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const ratedIds = new Set(
    Object.entries(db.ratings)
      .filter(([, arr]) => arr.some((r) => r.userId === userId))
      .map(([pid]) => parseInt(pid, 10))
  );

  const unrated = pokemonList.filter((p) => !ratedIds.has(p.id));
  const pool = unrated.length > 0 ? unrated : pokemonList;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  res.json({
    id: pick.id,
    name: pick.name,
    sprite: spriteUrl(pick.id),
    allRated: unrated.length === 0,
    totalPokemon: pokemonList.length,
  });
});

// Save (or update) one user's rating for one Pokémon, and return the community stats.
app.post('/api/rate', (req, res) => {
  const { userId, pokemonId, rating } = req.body || {};
  if (!userId || pokemonId == null || rating == null) {
    return res.status(400).json({ error: 'userId, pokemonId and rating are required' });
  }

  const clamped = Math.max(0, Math.min(100, Number(rating)));
  const key = String(pokemonId);
  if (!db.ratings[key]) db.ratings[key] = [];

  const existing = db.ratings[key].findIndex((r) => r.userId === userId);
  if (existing >= 0) {
    db.ratings[key][existing].rating = clamped;
  } else {
    db.ratings[key].push({ userId, rating: clamped });
  }
  saveDb();

  const stats = getStats(key);
  res.json({ yourRating: clamped, communityAverage: stats.average, communityCount: stats.count });
});

app.get('/api/pokemon/:id/stats', (req, res) => {
  res.json(getStats(String(req.params.id)));
});

// Community leaderboard: the "gayest" and "straightest" Pokémon by average rating.
app.get('/api/leaderboard', (req, res) => {
  const entries = Object.entries(db.ratings).map(([pid, arr]) => {
    const count = arr.length;
    const average = arr.reduce((sum, r) => sum + r.rating, 0) / count;
    const meta = pokemonList.find((p) => p.id === parseInt(pid, 10));
    return { id: parseInt(pid, 10), name: meta ? meta.name : `pokemon-${pid}`, average, count };
  });

  const gayest = [...entries].sort((a, b) => b.average - a.average).slice(0, 10);
  const straightest = [...entries].sort((a, b) => a.average - b.average).slice(0, 10);

  res.json({
    gayest,
    straightest,
    totalRatedPokemon: entries.length,
    totalPokemon: pokemonList.length,
  });
});

loadDb();
loadPokemonList().then(() => {
  app.listen(PORT, () => {
    console.log(`PokéQueer is running at http://localhost:${PORT}`);
  });
});
