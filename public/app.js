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
  submitBtn: document.getElementById('submitBtn'),
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

let current = null;

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

els.slider.addEventListener('input', () => {
  els.sliderValueLabel.textContent = labelFor(Number(els.slider.value));
});

async function loadNext() {
  els.submitBtn.disabled = true;
  els.slider.disabled = true;
  els.slider.value = 50;
  els.sliderValueLabel.textContent = labelFor(50);
  els.device.classList.add('loading');

  try {
    const res = await fetch(`/api/next?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    current = data;
    els.sprite.src = data.sprite;
    els.sprite.alt = data.name;
    els.name.textContent = capitalize(data.name);
    els.dex.textContent = `#${String(data.id).padStart(4, '0')}`;
  } finally {
    els.device.classList.remove('loading');
    els.submitBtn.disabled = false;
    els.slider.disabled = false;
  }
}

els.submitBtn.addEventListener('click', async () => {
  if (!current) return;
  const rated = current; // the Pokémon we're rating, before we move on
  const rating = Number(els.slider.value);
  els.submitBtn.disabled = true;
  els.slider.disabled = true;

  const res = await fetch('/api/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pokemonId: rated.id, rating }),
  });
  const data = await res.json();

  // Show how this pick compared, then move straight on to the next one.
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
  loadNext();
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

loadNext();
