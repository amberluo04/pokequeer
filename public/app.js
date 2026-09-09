function getUserId() {
  let id = localStorage.getItem('pq_userId');
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('pq_userId', id);
  }
  return id;
}
const userId = getUserId();

const els = {
  device: document.getElementById('card'),
  sprite: document.getElementById('sprite'),
  name: document.getElementById('name'),
  dex: document.getElementById('dex'),
  slider: document.getElementById('slider'),
  sliderValueLabel: document.getElementById('sliderValueLabel'),
  backBtn: document.getElementById('backBtn'),
  submitBtn: document.getElementById('submitBtn'),
  skipBabiesToggle: document.getElementById('skipBabiesToggle'),
  result: document.getElementById('result'),
  resultSprite: document.getElementById('resultSprite'),
  resultText: document.getElementById('resultText'),
  yourMarker: document.getElementById('yourMarker'),
  avgMarker: document.getElementById('avgMarker'),
  leaderboardBtn: document.getElementById('leaderboardBtn'),
  leaderboardPanel: document.getElementById('leaderboardPanel'),
  gayestList: document.getElementById('gayestList'),
  straightestList: document.getElementById('straightestList'),
  closeLeaderboard: document.getElementById('closeLeaderboard'),
};

// This session's Pokémon so far. Each entry: { id, name, sprite, rating }
// `rating` is null until the user submits one for it (used to restore the
// slider when they hit Back).
let history = [];
let historyIndex = -1;

function labelFor(v) {
  if (v < 15) return 'Very Straight';
  if (v < 35) return 'Straight-ish';
  if (v < 65) return 'Bi / Unclear';
  if (v < 85) return 'Gay-ish';
  return 'Very Gay';
}

function capitalize(s) {
  return s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ---- Skip baby Pokémon toggle (persisted) ----
els.skipBabiesToggle.checked = localStorage.getItem('pq_skipBabies') === 'true';
els.skipBabiesToggle.addEventListener('change', () => {
  localStorage.setItem('pq_skipBabies', els.skipBabiesToggle.checked ? 'true' : 'false');
  // Only affects Pokémon fetched from here on, not ones already in history.
});

els.slider.addEventListener('input', () => {
  els.sliderValueLabel.textContent = labelFor(Number(els.slider.value));
});

// Render whichever history entry is at `historyIndex` into the main card.
function showEntry(index) {
  const entry = history[index];
  if (!entry) return;
  historyIndex = index;

  els.sprite.src = entry.sprite;
  els.sprite.alt = entry.name;
  els.name.textContent = capitalize(entry.name);
  els.dex.textContent = `#${String(entry.id).padStart(4, '0')}`;

  const startAt = entry.rating != null ? entry.rating : 50;
  els.slider.value = startAt;
  els.sliderValueLabel.textContent = labelFor(startAt);

  els.backBtn.disabled = historyIndex === 0;
}

// Fetch a brand-new Pokémon from the server and add it to history.
async function fetchNext() {
  els.submitBtn.disabled = true;
  els.slider.disabled = true;
  els.device.classList.add('loading');

  try {
    const skipBabies = els.skipBabiesToggle.checked ? 'true' : 'false';
    const res = await fetch(`/api/next?userId=${encodeURIComponent(userId)}&skipBabies=${skipBabies}`);
    const data = await res.json();
    history.push({ id: data.id, name: data.name, sprite: data.sprite, rating: null });
    showEntry(history.length - 1);
  } finally {
    els.device.classList.remove('loading');
    els.submitBtn.disabled = false;
    els.slider.disabled = false;
  }
}

els.backBtn.addEventListener('click', () => {
  if (historyIndex > 0) {
    showEntry(historyIndex - 1);
  }
});

els.submitBtn.addEventListener('click', async () => {
  const rated = history[historyIndex];
  if (!rated) return;
  const rating = Number(els.slider.value);
  els.submitBtn.disabled = true;
  els.slider.disabled = true;
  els.backBtn.disabled = true;

  const res = await fetch('/api/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pokemonId: rated.id, rating }),
  });
  const data = await res.json();
  rated.rating = rating; // remember it, so Back restores this value later

  // Show how this pick compared, then move on.
  els.resultSprite.src = rated.sprite;
  els.resultSprite.alt = rated.name;
  els.yourMarker.style.left = `${rating}%`;

  if (data.communityAverage != null && data.communityCount > 1) {
    els.avgMarker.style.left = `${data.communityAverage}%`;
    els.avgMarker.classList.remove('hidden');
    els.resultText.textContent = `${capitalize(rated.name)}: you said "${labelFor(rating)}." Community average (${data.communityCount} ratings): ${data.communityAverage.toFixed(1)} / 100.`;
  } else {
    els.avgMarker.classList.add('hidden');
    els.resultText.textContent = `${capitalize(rated.name)}: you said "${labelFor(rating)}." You're the first to rate this one!`;
  }
  els.result.classList.remove('hidden');

  if (historyIndex < history.length - 1) {
    // We'd gone Back and just re-rated an earlier one — move forward to the
    // Pokémon we were already on, no need to fetch anything new.
    showEntry(historyIndex + 1);
    els.submitBtn.disabled = false;
    els.slider.disabled = false;
    els.backBtn.disabled = historyIndex === 0;
  } else {
    // We're at the front of history — fetch a genuinely new one.
    await fetchNext();
  }
});

els.leaderboardBtn.addEventListener('click', async () => {
  const res = await fetch('/api/leaderboard');
  const data = await res.json();
  renderLeaderboard(els.gayestList, data.gayest);
  renderLeaderboard(els.straightestList, data.straightest);
  els.leaderboardPanel.classList.remove('hidden');
});

els.closeLeaderboard.addEventListener('click', () => {
  els.leaderboardPanel.classList.add('hidden');
});

function renderLeaderboard(listEl, items) {
  listEl.innerHTML = '';
  if (!items || items.length === 0) {
    listEl.innerHTML = '<li class="empty">No ratings yet</li>';
    return;
  }
  items.forEach((item, i) => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${item.id}.png`;
    img.alt = item.name;
    li.innerHTML = `<span class="rank">${i + 1}</span>`;
    li.appendChild(img);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'pname';
    nameSpan.textContent = capitalize(item.name);
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'pscore';
    scoreSpan.textContent = item.average.toFixed(1);
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

fetchNext();
