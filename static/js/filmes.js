import { ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

const TMDB_API_KEY = "d39bbf74a96f6cca570dcb69c8f3059f";
const RAWG_API_KEY = "4a8f946edbb943dda1ee452b412e8eb0";

const state = {
  filmes: { items: [], filtered: [], currentIndex: 0, filter: 'todos', genre: 'todos' },
  series: { items: [], filtered: [], currentIndex: 0, filter: 'todos', genre: 'todos' },
  jogos:  { items: [], filtered: [], currentIndex: 0, filter: 'todos', genre: 'todos' },
  musicas: { items: [] },
};

const refs = {
  filmes: ref(db, 'filmes'),
  series: ref(db, 'series'),
  jogos:  ref(db, 'jogos'),
  musicas: ref(db, 'musicas'),
};

const autoplayTimers = {};
const AUTOPLAY_MS = 5000;

window.startAutoplay = function(section) {
  clearInterval(autoplayTimers[section]);
  const s = state[section];
  if (!s || !s.filtered || s.filtered.length <= 1) return;
  const bar = document.getElementById(`autoplay-bar-${section}`);
  if (bar && typeof gsap !== 'undefined') {
    gsap.fromTo(bar, { width: "0%" }, { width: "100%", duration: AUTOPLAY_MS/1000, ease: "none" });
  }
  autoplayTimers[section] = setInterval(() => { window.nextSlide(section); }, AUTOPLAY_MS);
};

window.stopAutoplay = function(section) {
  clearInterval(autoplayTimers[section]);
  const bar = document.getElementById(`autoplay-bar-${section}`);
  if (bar && typeof gsap !== 'undefined') {
    gsap.killTweensOf(bar);
    gsap.set(bar, { width: "0%" });
  }
};

async function fetchMovieData(title, year) {
  try {
    const y = year ? `&primary_release_year=${year}` : '';
    let res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=pt-BR${y}`);
    let data = await res.json();
    if (!data.results || !data.results.length) {
      res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US${y}`);
      data = await res.json();
    }
    if (data.results && data.results.length > 0) {
      return {
        poster: data.results[0].poster_path ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}` : '',
        backdrop: data.results[0].backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.results[0].backdrop_path}` : ''
      };
    }
  } catch(e) { console.error(e); }
  return { poster: '', backdrop: '' };
}

async function fetchTVData(title, year) {
  try {
    const y = year ? `&first_air_date_year=${year}` : '';
    let res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=pt-BR${y}`);
    let data = await res.json();
    if (!data.results || !data.results.length) {
      res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US${y}`);
      data = await res.json();
    }
    if (data.results && data.results.length > 0) {
      return {
        poster: data.results[0].poster_path ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}` : '',
        backdrop: data.results[0].backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.results[0].backdrop_path}` : ''
      };
    }
  } catch(e) { console.error(e); }
  return { poster: '', backdrop: '' };
}

async function fetchGameData(title) {
  try {
    const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(title)}&page_size=1`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return {
        poster: data.results[0].background_image || '',
        backdrop: data.results[0].background_image || ''
      };
    }
  } catch(e) { console.error(e); }
  return { poster: '', backdrop: '' };
}

const dataFetcher = { filmes: fetchMovieData, series: fetchTVData, jogos: fetchGameData };

function setupPreview(titleId, yearId, boxId, imgId, iconId, section) {
  const titleInput = document.getElementById(titleId);
  const yearInput  = document.getElementById(yearId);
  const previewBox = document.getElementById(boxId);
  const previewImg = document.getElementById(imgId);
  const icon       = document.getElementById(iconId);
  let timer;

  async function run() {
    clearTimeout(timer);
    const title = titleInput.value.trim();
    if (!title) { previewImg.style.display = 'none'; icon.style.display = 'block'; return; }
    timer = setTimeout(async () => {
      previewBox.style.opacity = '0.5';
      const mediaData = await dataFetcher[section](title, yearInput ? yearInput.value.trim() : '');
      const url = mediaData.poster || mediaData.backdrop;
      previewBox.style.opacity = '1';
      if (url) { previewImg.src = url; previewImg.style.display = 'block'; icon.style.display = 'none'; }
      else { previewImg.style.display = 'none'; icon.style.display = 'block'; }
    }, 700);
  }

  titleInput.addEventListener('input', run);
  if (yearInput) yearInput.addEventListener('input', run);
}

setupPreview('fTitle', 'fYear', 'poster-preview-box-filmes', 'poster-preview-img-filmes', 'poster-placeholder-icon-filmes', 'filmes');
setupPreview('sTitle', 'sYear', 'poster-preview-box-series', 'poster-preview-img-series', 'poster-placeholder-icon-series', 'series');
setupPreview('jTitle', 'jYear', 'poster-preview-box-jogos',  'poster-preview-img-jogos',  'poster-placeholder-icon-jogos',  'jogos');

function updateProgress(section) {
  const s = state[section];
  const total   = s.items.length;
  const watched = s.items.filter(m => section === 'filmes' ? (m.watched === true || m.watched === 'true') : (m.status === (section === 'series' ? 'concluida' : 'zerado'))).length;
  const pct     = total ? Math.round((watched / total) * 100) : 0;
  document.getElementById(`progressLabel-${section}`).textContent = `${watched} / ${total}`;
  document.getElementById(`progressFill-${section}`).style.width  = `${pct}%`;
}

function renderGenres(section) {
  const s = state[section];
  const genreSet = new Set();
  s.items.forEach(m => {
    if (m.genre) String(m.genre).split(',').forEach(g => { const c = g.trim().toLowerCase(); if (c) genreSet.add(c); });
  });
  const genres = Array.from(genreSet).sort();
  const row = document.getElementById(`genreRow-${section}`);
  let html = `<button class="gtag ${s.genre === 'todos' ? 'active' : ''}" data-genre="todos">Todos os Gêneros</button>`;
  genres.forEach(g => { html += `<button class="gtag ${s.genre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`; });
  row.innerHTML = html;
  row.querySelectorAll('.gtag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      s.genre = e.target.dataset.genre;
      renderGenres(section);
      renderItems(section);
    });
  });
}

const fallbackImgs = {
  filmes: 'https://placehold.co/1280x720/1a1c23/4da6ff?text=Sem+Capa',
  series: 'https://placehold.co/1280x720/1a231c/4dff99?text=Sem+Capa',
  jogos:  'https://placehold.co/1280x720/231a1c/ff4d7a?text=Sem+Capa',
};

const actionLabels = {
  filmes: { done: 'Marcar como assistido', empty: 'Nenhum filme encontrado.' },
  series: { done: 'Marcar como concluída', empty: 'Nenhuma série encontrada.' },
  jogos:  { done: 'Marcar como zerado',    empty: 'Nenhum jogo encontrado.' },
};

window.toggleItem = function(section, key, isDone) {
  if (section === 'filmes') update(ref(db, `filmes/${key}`), { watched: !isDone });
  else if (section === 'series') update(ref(db, `series/${key}`), { status: isDone ? 'quero ver' : 'concluida' });
  else update(ref(db, `jogos/${key}`), { status: isDone ? 'quero jogar' : 'zerado' });
};

window.deleteItem = function(section, key) { remove(ref(db, `${section}/${key}`)); };

window.openEdit = function(section, key) {
  const m = state[section].items.find(x => x.key === key);
  if (!m) return;
  document.getElementById(`edit-${section}-key`).value   = m.key || '';
  document.getElementById(`edit-${section}-title`).value = m.title || '';
  document.getElementById(`edit-${section}-date`).value  = m.targetDate || '';
  document.getElementById(`edit-${section}-genre`).value = m.genre || '';
  document.getElementById(`edit-${section}-year`).value  = m.year || '';
  document.getElementById(`edit-${section}-who`).value   = m.who || '';
  document.getElementById(`edit-${section}-where`).value = m.where || m.platform || '';
  if (section === 'series') {
    document.getElementById(`edit-${section}-seasons`).value = m.seasons || '';
    document.getElementById(`edit-${section}-status`).value  = m.status || 'quero ver';
  }
  if (section === 'jogos') {
    document.getElementById(`edit-${section}-platform`).value = m.platform || '';
    document.getElementById(`edit-${section}-status`).value   = m.status || 'quero jogar';
  }
  document.getElementById(`edit-dialog-${section}`).showModal();
};

function renderItems(section) {
  const s = state[section];
  const track = document.getElementById(`list-${section}`);
  const mainView = document.getElementById(`gallery-main-${section}`);

  const activeKey = (s.filtered && s.filtered[s.currentIndex]) ? s.filtered[s.currentIndex].key : null;

  s.filtered = s.items.filter(m => {
    const isDone = section === 'filmes' ? (m.watched === true || m.watched === 'true') : (m.status === (section === 'series' ? 'concluida' : 'zerado'));
    if (section === 'filmes') {
      if (s.filter === 'assistido' && !isDone) return false;
      if (s.filter === 'assistir'  &&  isDone) return false;
    } else {
      if (s.filter !== 'todos' && m.status !== s.filter) return false;
    }
    if (s.genre !== 'todos') {
      if (!m.genre) return false;
      const mGenres = String(m.genre).toLowerCase().split(',').map(g => g.trim());
      if (!mGenres.includes(s.genre)) return false;
    }
    return true;
  });

  if (!s.filtered.length) {
    track.innerHTML = '';
    mainView.innerHTML = `<div class="empty-state" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;"><p class="empty-text">${actionLabels[section].empty}</p></div>`;
    document.getElementById(`slider-prev-${section}`).style.display = 'none';
    document.getElementById(`slider-next-${section}`).style.display = 'none';
    window.stopAutoplay(section);
    return;
  }

  document.getElementById(`slider-prev-${section}`).style.display = 'flex';
  document.getElementById(`slider-next-${section}`).style.display = 'flex';
  track.innerHTML = '';

  s.filtered.forEach((m, idx) => {
    const isDone = section === 'filmes' ? (m.watched === true || m.watched === 'true') : (m.status === (section === 'series' ? 'concluida' : 'zerado'));
    const card = document.createElement('div');
    card.className = `slider-card ${isDone ? 'watched' : ''}`;
    const poster = (m.poster && m.poster.trim() !== "" && m.poster !== "N/A") ? m.poster : fallbackImgs[section];

    card.innerHTML = `<img src="${poster}" loading="lazy" class="slider-card-img" onerror="this.onerror=null;this.src='${fallbackImgs[section]}';">`;
    card.addEventListener('click', () => { if (idx !== s.currentIndex) { s.currentIndex = idx; updateSlider(section); } });
    track.appendChild(card);
  });

  if (activeKey) {
    const newIndex = s.filtered.findIndex(m => m.key === activeKey);
    s.currentIndex = newIndex !== -1 ? newIndex : 0;
  } else {
    s.currentIndex = 0;
  }

  updateSlider(section);
}

function updateSlider(section) {
  const s = state[section];
  const cards = document.querySelectorAll(`#list-${section} .slider-card`);
  const mainView = document.getElementById(`gallery-main-${section}`);

  cards.forEach((card, idx) => {
    if (idx === s.currentIndex) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const m = s.filtered[s.currentIndex];
  if(m) {
    const isDone = section === 'filmes' ? (m.watched === true || m.watched === 'true') : (m.status === (section === 'series' ? 'concluida' : 'zerado'));
    
    const bgImage = (m.backdrop && m.backdrop.trim() !== "" && m.backdrop !== "N/A") ? m.backdrop : 
                    ((m.poster && m.poster.trim() !== "" && m.poster !== "N/A") ? m.poster : fallbackImgs[section]);
                    
    const dateStr = m.targetDate ? String(m.targetDate).split('-').reverse().join('/') : '';
    
    let meta = '';
    if (section === 'filmes') meta = [dateStr, m.where, m.who ? `indicação: ${m.who}` : ''].filter(Boolean).join(' · ');
    else if (section === 'series') meta = [m.status, m.seasons ? `${m.seasons} temp.` : '', m.where].filter(Boolean).join(' · ');
    else meta = [m.status, m.platform, m.where].filter(Boolean).join(' · ');

    mainView.innerHTML = `
      <div class="autoplay-bar" id="autoplay-bar-${section}"></div>
      <img src="${bgImage}" class="gallery-main-img" onerror="this.onerror=null;this.src='${fallbackImgs[section]}';">
      <div class="gallery-main-overlay">
        <h3 class="gallery-main-title">${m.title}</h3>
        <div class="gallery-main-meta">${meta}</div>
        <div class="actions-group">
          <button class="movie-action-btn check ${isDone ? 'checked' : ''}" onclick="event.stopPropagation(); window.toggleItem('${section}','${m.key}',${isDone})" aria-label="${actionLabels[section].done}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button class="movie-action-btn edit" onclick="event.stopPropagation(); window.openEdit('${section}','${m.key}')" aria-label="Editar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="movie-action-btn delete" onclick="event.stopPropagation(); window.deleteItem('${section}','${m.key}')" aria-label="Deletar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    `;

    if (typeof gsap !== 'undefined') {
      const img = mainView.querySelector('.gallery-main-img');
      const overlay = mainView.querySelector('.gallery-main-overlay');
      
      const startF = isDone ? 'brightness(0.5) grayscale(100%)' : 'brightness(0.5) grayscale(0%)';
      const endF = isDone ? 'brightness(1) grayscale(100%)' : 'brightness(1) grayscale(0%)';
      
      if(img) gsap.killTweensOf(img);
      if(overlay) gsap.killTweensOf(overlay);

      gsap.fromTo(img, { opacity: 0, scale: 1.05, filter: startF }, { opacity: 1, scale: 1, filter: endF, duration: 0.6, ease: 'power2.out' });
      gsap.fromTo(overlay, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 });
    }

    const activeThumb = cards[s.currentIndex];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    
    window.startAutoplay(section);
  }

  const total = s.filtered.length;
  const prev  = document.getElementById(`slider-prev-${section}`);
  const next  = document.getElementById(`slider-next-${section}`);
  if (prev) prev.setAttribute('aria-disabled', s.currentIndex === 0);
  if (next) next.setAttribute('aria-disabled', s.currentIndex === total - 1);
}

window.prevSlide = function(section) {
  const s = state[section];
  if (s.currentIndex > 0) {
    s.currentIndex--;
    updateSlider(section);
    if (typeof gsap !== 'undefined') {
      const btn = document.getElementById(`slider-prev-${section}`);
      if (btn) gsap.fromTo(btn, { y: -4 }, { y: 0, duration: 0.35, ease: 'back.out(2)' });
    }
  }
};

window.nextSlide = function(section) {
  const s = state[section];
  if (s.currentIndex < s.filtered.length - 1) {
    s.currentIndex++;
    updateSlider(section);
    if (typeof gsap !== 'undefined') {
      const btn = document.getElementById(`slider-next-${section}`);
      if (btn) gsap.fromTo(btn, { y: 4 }, { y: 0, duration: 0.35, ease: 'back.out(2)' });
    }
  }
};

document.addEventListener('keydown', (e) => {
  const activeSection = ['filmes','series','jogos'].find(s => document.getElementById(`section-${s}`)?.classList.contains('active'));
  if (!activeSection) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') window.prevSlide(activeSection);
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') window.nextSlide(activeSection);
});

document.querySelectorAll('.gallery-layout').forEach(layout => {
  const mainView = layout.querySelector('.gallery-main');
  const section = mainView.id.replace('gallery-main-', '');
  
  layout.addEventListener('mouseenter', () => window.stopAutoplay(section));
  layout.addEventListener('mouseleave', () => window.startAutoplay(section));
  
  let startX = 0;
  let isDragging = false;
  
  mainView.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startX = e.clientX;
    window.stopAutoplay(section);
  });
  
  mainView.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.clientX - startX;
    if (diff > 50) window.prevSlide(section);
    else if (diff < -50) window.nextSlide(section);
    window.startAutoplay(section);
  });
  
  mainView.addEventListener('pointercancel', () => {
    isDragging = false;
  });
});

['filmes', 'series', 'jogos'].forEach(section => {
  onValue(refs[section], (snapshot) => {
    state[section].items = [];
    snapshot.forEach(child => { state[section].items.push({ key: child.key, ...child.val() }); });
    state[section].items.reverse();
    updateProgress(section);
    renderGenres(section);
    renderItems(section);
  });
});

['filmes', 'series', 'jogos'].forEach(section => {
  document.getElementById(`edit-form-${section}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const key      = document.getElementById(`edit-${section}-key`).value;
    const original = state[section].items.find(x => x.key === key);
    
    const newTitle = document.getElementById(`edit-${section}-title`).value.trim();
    const newYear  = document.getElementById(`edit-${section}-year`).value.trim();
    const btn      = document.getElementById(`btn-edit-${section}-submit`);
    const origHTML = btn.innerHTML;
    
    let finalPoster = original.poster || "";
    let finalBackdrop = original.backdrop || "";
    
    if (newTitle !== original.title || newYear !== original.year) {
      btn.innerHTML = '<span>Atualizando Capa...</span>';
      const fetched = await dataFetcher[section](newTitle, newYear);
      if (fetched && (fetched.poster || fetched.backdrop)) {
        finalPoster = fetched.poster || "";
        finalBackdrop = fetched.backdrop || "";
      }
    }
    
    const updateData = {
      title: newTitle || "", 
      year: newYear || "", 
      poster: finalPoster || "", 
      backdrop: finalBackdrop || "",
      targetDate: document.getElementById(`edit-${section}-date`).value || "",
      genre:      document.getElementById(`edit-${section}-genre`).value.trim() || "",
      who:        document.getElementById(`edit-${section}-who`).value.trim() || "",
    };
    
    if (section === 'filmes') {
      updateData.where = document.getElementById(`edit-filmes-where`).value.trim() || "";
    } else if (section === 'series') {
      updateData.where   = document.getElementById(`edit-series-where`).value.trim() || "";
      updateData.seasons = document.getElementById(`edit-series-seasons`).value || "";
      updateData.status  = document.getElementById(`edit-series-status`).value || "quero ver";
    } else {
      updateData.where    = document.getElementById(`edit-jogos-where`).value.trim() || "";
      updateData.platform = document.getElementById(`edit-jogos-platform`).value.trim() || "";
      updateData.status   = document.getElementById(`edit-jogos-status`).value || "quero jogar";
    }
    
    await update(ref(db, `${section}/${key}`), updateData);
    btn.innerHTML = origHTML;
    document.getElementById(`edit-dialog-${section}`).close();
  });
});

document.getElementById('form-filmes').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('fTitle').value.trim(); 
  if (!title) return;
  const year  = document.getElementById('fYear').value.trim();
  const btn   = document.getElementById('btn-add-filmes');
  const orig  = btn.innerHTML;
  btn.innerHTML = '<span>Buscando Capa...</span>';
  
  const mediaData = await fetchMovieData(title, year);
  
  await push(refs.filmes, { 
    title, 
    year: year || "", 
    poster: mediaData.poster || "", 
    backdrop: mediaData.backdrop || "",
    watched: false,
    targetDate: document.getElementById('fTargetDate').value || "",
    genre:      document.getElementById('fGenre').value.trim() || "",
    who:        document.getElementById('fWho').value.trim() || "",
    where:      document.getElementById('fWhere').value.trim() || "",
  });
  
  document.getElementById('form-filmes').reset();
  document.getElementById('poster-preview-img-filmes').style.display = 'none';
  document.getElementById('poster-placeholder-icon-filmes').style.display = 'block';
  btn.innerHTML = orig;
});

document.getElementById('form-series').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('sTitle').value.trim(); 
  if (!title) return;
  const year  = document.getElementById('sYear').value.trim();
  const btn   = document.getElementById('btn-add-series');
  const orig  = btn.innerHTML;
  btn.innerHTML = '<span>Buscando Capa...</span>';
  
  const mediaData = await fetchTVData(title, year);
  
  await push(refs.series, { 
    title, 
    year: year || "", 
    poster: mediaData.poster || "", 
    backdrop: mediaData.backdrop || "",
    status: document.getElementById('sStatus').value || "quero ver",
    targetDate: document.getElementById('sTargetDate').value || "",
    genre:      document.getElementById('sGenre').value.trim() || "",
    seasons:    document.getElementById('sSeasons').value || "",
    who:        document.getElementById('sWho').value.trim() || "",
    where:      document.getElementById('sWhere').value.trim() || "",
  });
  
  document.getElementById('form-series').reset();
  document.getElementById('poster-preview-img-series').style.display = 'none';
  document.getElementById('poster-placeholder-icon-series').style.display = 'block';
  btn.innerHTML = orig;
});

document.getElementById('form-jogos').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('jTitle').value.trim(); 
  if (!title) return;
  const year  = document.getElementById('jYear').value.trim();
  const btn   = document.getElementById('btn-add-jogos');
  const orig  = btn.innerHTML;
  btn.innerHTML = '<span>Buscando Capa...</span>';
  
  const mediaData = await fetchGameData(title);
  
  await push(refs.jogos, { 
    title, 
    year: year || "", 
    poster: mediaData.poster || "", 
    backdrop: mediaData.backdrop || "",
    status: document.getElementById('jStatus').value || "quero jogar",
    targetDate: document.getElementById('jTargetDate').value || "",
    genre:      document.getElementById('jGenre').value.trim() || "",
    platform:   document.getElementById('jPlatform').value.trim() || "",
    who:        document.getElementById('jWho').value.trim() || "",
    where:      document.getElementById('jWhere').value.trim() || "",
  });
  
  document.getElementById('form-jogos').reset();
  document.getElementById('poster-preview-img-jogos').style.display = 'none';
  document.getElementById('poster-placeholder-icon-jogos').style.display = 'block';
  btn.innerHTML = orig;
});

function extractIframeSrc(input) {
  const match = input.match(/src=["'](.*?)["']/);
  if (match) return match[1];

  let url = input.trim();
  if (!url.startsWith('http')) return '';

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('spotify.com')) {
      if (!urlObj.pathname.startsWith('/embed/')) {
        return `https://open.spotify.com/embed${urlObj.pathname}?utm_source=generator`;
      }
    }
    if (urlObj.hostname.includes('music.apple.com')) {
      return `https://embed.music.apple.com${urlObj.pathname}${urlObj.search}`;
    }
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = urlObj.searchParams.get('v');
      if (urlObj.hostname.includes('youtu.be')) videoId = urlObj.pathname.slice(1);
      let listId = urlObj.searchParams.get('list');
      
      if (videoId) return `https://www.youtube.com/embed/${videoId}${listId ? '?list='+listId : ''}`;
      if (listId) return `https://www.youtube.com/embed/videoseries?list=${listId}`;
    }
    return url;
  } catch(e) {
    return '';
  }
}

document.getElementById('form-musicas').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('mTitle').value.trim();
  const linkInput = document.getElementById('mLink').value.trim();
  if (!title || !linkInput) return;
  
  const src = extractIframeSrc(linkInput);
  if (!src) { alert('URL ou código iframe inválido.'); return; }
  
  const btn = document.getElementById('btn-add-musicas');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span>Adicionando...</span>';
  
  await push(refs.musicas, { title, src, timestamp: Date.now() });
  
  document.getElementById('form-musicas').reset();
  btn.innerHTML = orig;
});

function renderMusicas() {
  const track = document.getElementById('list-musicas');
  const items = state.musicas.items;
  
  if (!items.length) {
    track.innerHTML = `<div class="empty-state" style="grid-column-start:1;grid-column-end:-1;"><p class="empty-text">Aguardando playlists...</p></div>`;
    return;
  }
  
  track.innerHTML = '';
  items.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = 'musica-card';
    card.innerHTML = `
      <div class="musica-card-header">
        <h3 class="musica-title">${m.title}</h3>
        <button class="movie-action-btn delete" onclick="window.deleteItem('musicas','${m.key}')" aria-label="Deletar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="musica-iframe-wrapper">
        <iframe allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" frameborder="0" height="450" style="width:100%;max-width:660px;overflow:hidden;border-radius:10px;" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" src="${m.src}"></iframe>
      </div>
    `;
    track.appendChild(card);
    
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: idx * 0.1 });
    }
  });
}

onValue(refs.musicas, (snapshot) => {
  state.musicas.items = [];
  snapshot.forEach(child => { state.musicas.items.push({ key: child.key, ...child.val() }); });
  state.musicas.items.reverse();
  renderMusicas();
});

document.querySelectorAll('.ftab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const section = e.target.dataset.section;
    if(section !== 'musicas'){
      document.querySelectorAll(`.ftab[data-section="${section}"]`).forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state[section].filter = e.target.dataset.filter;
      renderItems(section);
    }
  });
});

document.querySelectorAll('.main-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const section = e.currentTarget.dataset.section;
    document.querySelectorAll('.main-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    e.currentTarget.classList.add('active');
    e.currentTarget.setAttribute('aria-selected', 'true');
    
    document.querySelectorAll('.media-section').forEach(s => {
      s.classList.remove('active');
      window.stopAutoplay(s.id.replace('section-', ''));
    });
    
    document.getElementById(`section-${section}`).classList.add('active');
    window.startAutoplay(section);
  });
});