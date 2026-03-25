import { ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

// ─── Configuração ────────────────────────────────────────────────────────────
const TMDB_API_KEY  = "d39bbf74a96f6cca570dcb69c8f3059f";
const RAWG_API_KEY  = "4a8f946edbb943dda1ee452b412e8eb0";
const AUTOPLAY_MS   = 6000;
const DEBOUNCE_MS   = 700;

// ─── Cache de API ─────────────────────────────────────────────────────────────
const apiCache = new Map();

function getCacheKey(section, title, year = "") {
  return `${section}::${title.toLowerCase().trim()}::${year.trim()}`;
}

// ─── Estado central ───────────────────────────────────────────────────────────
const state = {
  filmes:  { items: [], filtered: [], currentIndex: 0, filter: "todos", genre: "todos" },
  series:  { items: [], filtered: [], currentIndex: 0, filter: "todos", genre: "todos" },
  jogos:   { items: [], filtered: [], currentIndex: 0, filter: "todos", genre: "todos" },
  musicas: { items: [] },
};

const dbRefs = {
  filmes:  ref(db, "filmes"),
  series:  ref(db, "series"),
  jogos:   ref(db, "jogos"),
  musicas: ref(db, "musicas"),
};

// ─── Autoplay Seguro ──────────────────────────────────────────────────────────
const autoplayTimers = {};

window.startAutoplay = function (section) {
  clearTimeout(autoplayTimers[section]);
  
  const sectionEl = document.getElementById(`section-${section}`);
  if (!sectionEl || !sectionEl.classList.contains("active")) return;

  const s = state[section];
  if (!s?.filtered?.length || s.filtered.length <= 1) return;

  const bar = document.getElementById(`autoplay-bar-${section}`);
  if (bar && typeof gsap !== "undefined") {
    gsap.killTweensOf(bar);
    gsap.fromTo(bar, { width: "0%" }, { width: "100%", duration: AUTOPLAY_MS / 1000, ease: "none" });
  }

  autoplayTimers[section] = setTimeout(() => {
    const cur = state[section];
    cur.currentIndex = (cur.currentIndex + 1) % cur.filtered.length;
    updateSlider(section);
  }, AUTOPLAY_MS);
};

window.stopAutoplay = function (section) {
  clearTimeout(autoplayTimers[section]);
  const bar = document.getElementById(`autoplay-bar-${section}`);
  if (bar && typeof gsap !== "undefined") {
    gsap.killTweensOf(bar);
    gsap.set(bar, { width: "0%" });
  }
};

// ─── Busca de dados externos ──────────────────────────────────────────────────
async function safeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function fetchMovieData(title, year = "") {
  const key = getCacheKey("filmes", title, year);
  if (apiCache.has(key)) return apiCache.get(key);

  const yearParam = year ? `&primary_release_year=${year}` : "";
  const base = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;

  try {
    let data = await safeFetch(`${base}&language=pt-BR${yearParam}`);
    if (!data.results?.length) data = await safeFetch(`${base}&language=en-US${yearParam}`);

    if (data.results?.length) {
      const r = data.results[0];
      const result = {
        poster:   r.poster_path   ? `https://image.tmdb.org/t/p/w500${r.poster_path}`   : "",
        backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : "",
      };
      apiCache.set(key, result);
      return result;
    }
  } catch (err) { console.warn("[fetchMovieData]", err.message); }
  return { poster: "", backdrop: "" };
}

async function fetchTVData(title, year = "") {
  const key = getCacheKey("series", title, year);
  if (apiCache.has(key)) return apiCache.get(key);

  const yearParam = year ? `&first_air_date_year=${year}` : "";
  const base = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;

  try {
    let data = await safeFetch(`${base}&language=pt-BR${yearParam}`);
    if (!data.results?.length) data = await safeFetch(`${base}&language=en-US${yearParam}`);

    if (data.results?.length) {
      const r = data.results[0];
      const result = {
        poster:   r.poster_path   ? `https://image.tmdb.org/t/p/w500${r.poster_path}`   : "",
        backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : "",
      };
      apiCache.set(key, result);
      return result;
    }
  } catch (err) { console.warn("[fetchTVData]", err.message); }
  return { poster: "", backdrop: "" };
}

async function fetchGameData(title, year = "") {
  const key = getCacheKey("jogos", title, year);
  if (apiCache.has(key)) return apiCache.get(key);

  try {
    const data = await safeFetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(title)}&page_size=1`);
    if (data.results?.length) {
      const img = data.results[0].background_image || "";
      const result = { poster: img, backdrop: img };
      apiCache.set(key, result);
      return result;
    }
  } catch (err) { console.warn("[fetchGameData]", err.message); }
  return { poster: "", backdrop: "" };
}

const dataFetcher = { filmes: fetchMovieData, series: fetchTVData, jogos: fetchGameData };

// ─── Preview de capa no formulário ────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function setupPreview(titleId, yearId, boxId, imgId, iconId, section) {
  const titleInput = document.getElementById(titleId);
  const yearInput  = document.getElementById(yearId);
  const previewBox = document.getElementById(boxId);
  const previewImg = document.getElementById(imgId);
  const icon       = document.getElementById(iconId);

  if (!titleInput || !previewBox || !previewImg || !icon) return;

  async function run() {
    const title = titleInput.value.trim();
    if (!title) {
      previewImg.style.display = "none";
      icon.style.display = "block";
      return;
    }

    previewBox.style.opacity = "0.5";
    const mediaData = await dataFetcher[section](title, yearInput?.value.trim() ?? "");
    const url = mediaData.poster || mediaData.backdrop;
    previewBox.style.opacity = "1";

    if (url) {
      previewImg.src = url;
      previewImg.style.display = "block";
      icon.style.display = "none";
    } else {
      previewImg.style.display = "none";
      icon.style.display = "block";
    }
  }

  const debouncedRun = debounce(run, DEBOUNCE_MS);
  titleInput.addEventListener("input", debouncedRun);
  yearInput?.addEventListener("input", debouncedRun);
}

setupPreview("fTitle", "fYear", "poster-preview-box-filmes", "poster-preview-img-filmes", "poster-placeholder-icon-filmes", "filmes");
setupPreview("sTitle", "sYear", "poster-preview-box-series", "poster-preview-img-series", "poster-placeholder-icon-series", "series");
setupPreview("jTitle", "jYear", "poster-preview-box-jogos",  "poster-preview-img-jogos",  "poster-placeholder-icon-jogos",  "jogos");

// ─── Helpers e Progresso ──────────────────────────────────────────────────────
function isDoneItem(section, item) {
  if (section === "filmes") return item.watched === true || item.watched === "true";
  if (section === "series") return item.status === "concluida";
  if (section === "jogos")  return item.status === "zerado";
  return false;
}

function updateProgress(section) {
  const s       = state[section];
  const total   = s.items.length;
  const watched = s.items.filter(m => isDoneItem(section, m)).length;
  const pct     = total ? Math.round((watched / total) * 100) : 0;

  const label = document.getElementById(`progressLabel-${section}`);
  const fill  = document.getElementById(`progressFill-${section}`);
  if (label) label.textContent = `${watched} / ${total}`;
  if (fill)  fill.style.width  = `${pct}%`;
}

// ─── Filtro de gênero ─────────────────────────────────────────────────────────
function parseGenres(genreStr) {
  if (!genreStr) return [];
  return String(genreStr).split(",").map(g => g.trim().toLowerCase()).filter(Boolean);
}

function renderGenres(section) {
  const s   = state[section];
  const row = document.getElementById(`genreRow-${section}`);
  if (!row) return;

  const genreSet = new Set();
  s.items.forEach(m => parseGenres(m.genre).forEach(g => genreSet.add(g)));
  const genres = Array.from(genreSet).sort();

  row.innerHTML = [
    `<button class="gtag ${s.genre === "todos" ? "active" : ""}" data-genre="todos">Todos os Gêneros</button>`,
    ...genres.map(g => `<button class="gtag ${s.genre === g ? "active" : ""}" data-genre="${g}">${g}</button>`),
  ].join("");

  row.querySelectorAll(".gtag").forEach(btn => {
    btn.addEventListener("click", () => {
      s.genre = btn.dataset.genre;
      renderGenres(section);
      renderItems(section);
    });
  });
}

// ─── Imagens de fallback e Ações ──────────────────────────────────────────────
const fallbackImgs = {
  filmes: "https://placehold.co/1280x720/1a1c23/4da6ff?text=Sem+Capa",
  series: "https://placehold.co/1280x720/1a231c/4dff99?text=Sem+Capa",
  jogos:  "https://placehold.co/1280x720/231a1c/ff4d7a?text=Sem+Capa",
};

const actionLabels = {
  filmes: { done: "Marcar como assistido", empty: "Nenhum filme encontrado." },
  series: { done: "Marcar como concluída", empty: "Nenhuma série encontrada." },
  jogos:  { done: "Marcar como zerado",    empty: "Nenhum jogo encontrado."  },
};

function validImage(url) {
  return url && url.trim() !== "" && url !== "N/A" ? url : null;
}

window.toggleItem = function (section, key, currentlyDone) {
  if (section === "filmes") update(ref(db, `filmes/${key}`), { watched: !currentlyDone });
  else if (section === "series") update(ref(db, `series/${key}`), { status: currentlyDone ? "quero ver" : "concluida" });
  else update(ref(db, `jogos/${key}`), { status: currentlyDone ? "quero jogar" : "zerado" });
};

window.deleteItem = function (section, key) { remove(ref(db, `${section}/${key}`)); };

window.openEdit = function (section, key) {
  const m = state[section].items.find(x => x.key === key);
  if (!m) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };

  set(`edit-${section}-key`,   m.key);
  set(`edit-${section}-title`, m.title);
  set(`edit-${section}-date`,  m.targetDate);
  set(`edit-${section}-genre`, m.genre);
  set(`edit-${section}-year`,  m.year);
  set(`edit-${section}-who`,   m.who);
  set(`edit-${section}-where`, m.where ?? m.platform);

  if (section === "filmes") {
    set(`edit-filmes-rating-score`, m.ratingScore);
    set(`edit-filmes-rating-user`, m.ratingUser);
  }

  if (section === "series") {
    set(`edit-series-seasons`, m.seasons);
    set(`edit-series-status`,  m.status ?? "quero ver");
  }
  
  if (section === "jogos") {
    set(`edit-jogos-platform`, m.platform);
    set(`edit-jogos-status`,   m.status ?? "quero jogar");
  }

  document.getElementById(`edit-dialog-${section}`)?.showModal();
};

// ─── Renderização principal ───────────────────────────────────────────────────
function applyFilter(section) {
  const s = state[section];
  s.filtered = s.items.filter(m => {
    const done = isDoneItem(section, m);
    if (section === "filmes") {
      if (s.filter === "assistido" && !done) return false;
      if (s.filter === "assistir"  &&  done) return false;
    } else {
      if (s.filter !== "todos" && m.status !== s.filter) return false;
    }
    if (s.genre !== "todos" && !parseGenres(m.genre).includes(s.genre)) return false;
    return true;
  });
}

function renderItems(section) {
  const s        = state[section];
  const track    = document.getElementById(`list-${section}`);
  const mainView = document.getElementById(`gallery-main-${section}`);
  if (!track || !mainView) return;

  const activeKey = s.filtered[s.currentIndex]?.key ?? null;
  applyFilter(section);

  const prevBtn = document.getElementById(`slider-prev-${section}`);
  const nextBtn = document.getElementById(`slider-next-${section}`);

  if (!s.filtered.length) {
    track.innerHTML = "";
    mainView.innerHTML = `
      <div class="empty-state" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;">
        <p class="empty-text">${actionLabels[section].empty}</p>
      </div>`;
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
    window.stopAutoplay(section);
    return;
  }

  if (prevBtn) prevBtn.style.display = "flex";
  if (nextBtn) nextBtn.style.display = "flex";

  track.innerHTML = "";
  const fragment = document.createDocumentFragment();

  s.filtered.forEach((m, idx) => {
    const done   = isDoneItem(section, m);
    const poster = validImage(m.poster) ?? fallbackImgs[section];

    const card = document.createElement("div");
    card.className = `slider-card${done ? " watched" : ""}`;
    card.innerHTML = `<img src="${poster}" loading="lazy" class="slider-card-img" alt="${m.title}" onerror="this.onerror=null;this.src='${fallbackImgs[section]}';">`;
    card.addEventListener("click", () => {
      if (idx !== s.currentIndex) {
        s.currentIndex = idx;
        updateSlider(section);
      }
    });
    fragment.appendChild(card);
  });

  track.appendChild(fragment);

  const newIndex = activeKey ? s.filtered.findIndex(m => m.key === activeKey) : -1;
  s.currentIndex = newIndex !== -1 ? newIndex : 0;

  updateSlider(section);
}

function buildMainHTML(section, m) {
  const done     = isDoneItem(section, m);
  const bgImage  = validImage(m.backdrop) ?? validImage(m.poster) ?? fallbackImgs[section];
  const dateStr  = m.targetDate ? String(m.targetDate).split("-").reverse().join("/") : "";

  let meta = "";
  let ratingHTML = "";

  if (section === "filmes") {
    meta = [dateStr, m.where, m.who ? `indicação: ${m.who}` : ""].filter(Boolean).join(" · ");
    
    // Construtor de Estrelas SVG
    if (m.ratingScore && m.ratingUser) {
      const score = parseInt(m.ratingScore);
      let stars = "";
      for(let i=1; i<=5; i++) {
        const fill = i <= score ? "var(--amber)" : "none";
        const stroke = i <= score ? "var(--amber)" : "rgba(255,255,255,0.3)";
        stars += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: all 0.3s ease;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      }
      ratingHTML = `
        <div class="movie-rating" style="display:flex; align-items:center; gap:0.6rem; margin-bottom: 1.2rem; background: rgba(0,0,0,0.4); padding: 6px 12px; border-radius: 50px; width: fit-content; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; gap:3px;">${stars}</div>
          <span style="font-family:var(--font-mono); font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em; padding-top:2px;">por ${m.ratingUser}</span>
        </div>
      `;
    }
  } else if (section === "series") {
    meta = [m.status, m.seasons ? `${m.seasons} temp.` : "", m.where].filter(Boolean).join(" · ");
  } else {
    meta = [m.status, m.platform, m.where].filter(Boolean).join(" · ");
  }

  const esc = (v) => String(v ?? "").replace(/'/g, "\\'");

  return `
    <div class="autoplay-bar" id="autoplay-bar-${section}"></div>
    <img src="${bgImage}" class="gallery-main-img" alt="${m.title}" onerror="this.onerror=null;this.src='${fallbackImgs[section]}';">
    <div class="gallery-main-overlay">
      <h3 class="gallery-main-title">${m.title}</h3>
      ${ratingHTML}
      <div class="gallery-main-meta">${meta}</div>
      <div class="actions-group">
        <button class="movie-action-btn check ${done ? "checked" : ""}" onclick="event.stopPropagation(); window.toggleItem('${section}','${esc(m.key)}',${done})" aria-label="${actionLabels[section].done}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button class="movie-action-btn edit" onclick="event.stopPropagation(); window.openEdit('${section}','${esc(m.key)}')" aria-label="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="movie-action-btn delete" onclick="event.stopPropagation(); window.deleteItem('${section}','${esc(m.key)}')" aria-label="Deletar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>`;
}

function updateSlider(section) {
  const s        = state[section];
  const mainView = document.getElementById(`gallery-main-${section}`);
  const cards    = document.querySelectorAll(`#list-${section} .slider-card`);
  if (!mainView) return;

  cards.forEach((card, idx) => card.classList.toggle("active", idx === s.currentIndex));

  const m = s.filtered[s.currentIndex];
  if (!m) return;

  mainView.innerHTML = buildMainHTML(section, m);

  if (typeof gsap !== "undefined") {
    const img     = mainView.querySelector(".gallery-main-img");
    const overlay = mainView.querySelector(".gallery-main-overlay");
    const done    = isDoneItem(section, m);
    const filter  = done ? "brightness(1) grayscale(100%)" : "brightness(1) grayscale(0%)";
    const filterStart = done ? "brightness(0.5) grayscale(100%)" : "brightness(0.5) grayscale(0%)";

    if (img)     gsap.fromTo(img,     { opacity: 0, scale: 1.05, filter: filterStart }, { opacity: 1, scale: 1,    filter, duration: 0.6, ease: "power2.out" });
    if (overlay) gsap.fromTo(overlay, { opacity: 0, y: 20 },                            { opacity: 1, y: 0,                 duration: 0.6, ease: "power2.out", delay: 0.1 });
  }

  cards[s.currentIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

  const total   = s.filtered.length;
  const prevBtn = document.getElementById(`slider-prev-${section}`);
  const nextBtn = document.getElementById(`slider-next-${section}`);
  if (prevBtn) prevBtn.setAttribute("aria-disabled", String(s.currentIndex === 0));
  if (nextBtn) nextBtn.setAttribute("aria-disabled", String(s.currentIndex === total - 1));

  window.startAutoplay(section);
}

// ─── Navegação de slides ──────────────────────────────────────────────────────
window.prevSlide = function (section) {
  const s = state[section];
  if (s.currentIndex <= 0) return;
  s.currentIndex--;
  updateSlider(section);
  animateNavBtn(`slider-prev-${section}`, -4);
};

window.nextSlide = function (section) {
  const s = state[section];
  if (s.currentIndex >= s.filtered.length - 1) return;
  s.currentIndex++;
  updateSlider(section);
  animateNavBtn(`slider-next-${section}`, 4);
};

function animateNavBtn(id, yFrom) {
  if (typeof gsap === "undefined") return;
  const btn = document.getElementById(id);
  if (btn) gsap.fromTo(btn, { y: yFrom }, { y: 0, duration: 0.35, ease: "back.out(2)" });
}

// ─── Eventos de Interação (Teclado e Swipe) ───────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  const activeSection = ["filmes", "series", "jogos"].find(s => document.getElementById(`section-${s}`)?.classList.contains("active"));
  if (!activeSection) return;
  if (e.key === "ArrowUp"   || e.key === "ArrowLeft")  window.prevSlide(activeSection);
  if (e.key === "ArrowDown" || e.key === "ArrowRight") window.nextSlide(activeSection);
});

document.querySelectorAll(".gallery-layout").forEach(layout => {
  const mainView = layout.querySelector(".gallery-main");
  if (!mainView) return;

  const section = mainView.id.replace("gallery-main-", "");
  let startX = 0, isDragging = false;

  layout.addEventListener("mouseenter", () => window.stopAutoplay(section));
  layout.addEventListener("mouseleave", () => window.startAutoplay(section));

  mainView.addEventListener("pointerdown", e => { isDragging = true; startX = e.clientX; window.stopAutoplay(section); });
  mainView.addEventListener("pointerup", e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.clientX - startX;
    if (diff > 50)       window.prevSlide(section);
    else if (diff < -50) window.nextSlide(section);
    window.startAutoplay(section);
  });
  mainView.addEventListener("pointercancel", () => { isDragging = false; });
});

// ─── Firebase: Escuta em Tempo Real ───────────────────────────────────────────
["filmes", "series", "jogos"].forEach(section => {
  onValue(dbRefs[section], snapshot => {
    state[section].items = [];
    snapshot.forEach(child => { 
      state[section].items.push({ key: child.key, ...child.val() }); 
    });
    state[section].items.reverse();
    updateProgress(section);
    renderGenres(section);
    renderItems(section);
  });
});

onValue(dbRefs.musicas, snapshot => {
  state.musicas.items = [];
  snapshot.forEach(child => { 
    state.musicas.items.push({ key: child.key, ...child.val() }); 
  });
  state.musicas.items.reverse();
  renderMusicas();
});

// ─── Formulários de Edição ────────────────────────────────────────────────────
["filmes", "series", "jogos"].forEach(section => {
  const form = document.getElementById(`edit-form-${section}`);
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const key      = document.getElementById(`edit-${section}-key`).value;
    const original = state[section].items.find(x => x.key === key);
    if (!original) return;

    const newTitle = document.getElementById(`edit-${section}-title`).value.trim();
    const newYear  = document.getElementById(`edit-${section}-year`).value.trim();
    const btn      = document.getElementById(`btn-edit-${section}-submit`);
    const origHTML = btn?.innerHTML ?? "";

    let finalPoster   = original.poster   ?? "";
    let finalBackdrop = original.backdrop ?? "";

    if (newTitle !== original.title || newYear !== original.year) {
      if (btn) btn.innerHTML = "<span>Atualizando Capa…</span>";
      try {
        const fetched = await dataFetcher[section](newTitle, newYear);
        if (fetched.poster || fetched.backdrop) {
          finalPoster   = fetched.poster   ?? "";
          finalBackdrop = fetched.backdrop ?? "";
        }
      } catch (err) { console.warn("[edit] Falha ao buscar capa:", err.message); }
    }

    const get = id => document.getElementById(id)?.value.trim() ?? "";
    const updateData = {
      title:      newTitle,
      year:       newYear,
      poster:     finalPoster,
      backdrop:   finalBackdrop,
      targetDate: get(`edit-${section}-date`),
      genre:      get(`edit-${section}-genre`),
      who:        get(`edit-${section}-who`),
    };

    if (section === "filmes") {
      updateData.where = get("edit-filmes-where");
      updateData.ratingScore = get("edit-filmes-rating-score");
      updateData.ratingUser = get("edit-filmes-rating-user");
    } else if (section === "series") {
      updateData.where   = get("edit-series-where");
      updateData.seasons = get("edit-series-seasons");
      updateData.status  = document.getElementById("edit-series-status")?.value ?? "quero ver";
    } else {
      updateData.where    = get("edit-jogos-where");
      updateData.platform = get("edit-jogos-platform");
      updateData.status   = document.getElementById("edit-jogos-status")?.value ?? "quero jogar";
    }

    await update(ref(db, `${section}/${key}`), updateData);
    if (btn) btn.innerHTML = origHTML;
    document.getElementById(`edit-dialog-${section}`)?.close();
  });
});

// ─── Formulários de Adição ────────────────────────────────────────────────────
async function handleAddSubmit(section, fetchFn, fields) {
  const title = document.getElementById(fields.title)?.value.trim();
  if (!title) return;

  const year = document.getElementById(fields.year)?.value.trim() ?? "";
  const btn  = document.getElementById(fields.btn);
  const orig = btn?.innerHTML ?? "";
  if (btn) btn.innerHTML = "<span>Buscando Capa…</span>";

  let mediaData = { poster: "", backdrop: "" };
  try { mediaData = await fetchFn(title, year); } 
  catch (err) { console.warn("[add] Falha ao buscar capa:", err.message); }

  const get = id => document.getElementById(id)?.value ?? "";
  const payload = {
    title,
    year:       year,
    poster:     mediaData.poster   ?? "",
    backdrop:   mediaData.backdrop ?? "",
    targetDate: get(fields.targetDate),
    genre:      get(fields.genre).trim(),
    who:        get(fields.who).trim(),
    ...fields.extra(get),
  };

  await push(dbRefs[section], payload);

  document.getElementById(fields.formId)?.reset();
  const img  = document.getElementById(fields.previewImg);
  const icon = document.getElementById(fields.previewIcon);
  if (img)  img.style.display  = "none";
  if (icon) icon.style.display = "block";
  if (btn)  btn.innerHTML = orig;
}

document.getElementById("form-filmes")?.addEventListener("submit", e => {
  e.preventDefault();
  handleAddSubmit("filmes", fetchMovieData, {
    formId: "form-filmes", title: "fTitle", year: "fYear", btn: "btn-add-filmes", targetDate: "fTargetDate", genre: "fGenre", who: "fWho",
    previewImg: "poster-preview-img-filmes", previewIcon: "poster-placeholder-icon-filmes",
    extra: get => ({ 
      watched: false, 
      where: get("fWhere").trim(),
      ratingScore: get("fRatingScore"),
      ratingUser: get("fRatingUser")
    }),
  });
});

document.getElementById("form-series")?.addEventListener("submit", e => {
  e.preventDefault();
  handleAddSubmit("series", fetchTVData, {
    formId: "form-series", title: "sTitle", year: "sYear", btn: "btn-add-series", targetDate: "sTargetDate", genre: "sGenre", who: "sWho",
    previewImg: "poster-preview-img-series", previewIcon: "poster-placeholder-icon-series",
    extra: get => ({ status: get("sStatus") || "quero ver", seasons: get("sSeasons"), where: get("sWhere").trim() }),
  });
});

document.getElementById("form-jogos")?.addEventListener("submit", e => {
  e.preventDefault();
  handleAddSubmit("jogos", fetchGameData, {
    formId: "form-jogos", title: "jTitle", year: "jYear", btn: "btn-add-jogos", targetDate: "jTargetDate", genre: "jGenre", who: "jWho",
    previewImg: "poster-preview-img-jogos", previewIcon: "poster-placeholder-icon-jogos",
    extra: get => ({ status: get("jStatus") || "quero jogar", platform: get("jPlatform").trim(), where: get("jWhere").trim() }),
  });
});

// ─── Músicas (Spotify/YouTube/Apple Music) ────────────────────────────────────
function extractIframeSrc(input) {
  const match = input.match(/src=["'](.*?)["']/);
  if (match) return match[1];

  const url = input.trim();
  if (!url.startsWith("http")) return "";

  try {
    const u = new URL(url);
    if (u.hostname.includes("spotify.com")) {
      return `https://open.spotify.com/embed${u.pathname}?utm_source=generator`;
    }
    if (u.hostname.includes("music.apple.com")) {
      return `https://embed.music.apple.com${u.pathname}${u.search}`;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      const videoId = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v");
      const listId  = u.searchParams.get("list");
      if (videoId) return `https://www.youtube.com/embed/${videoId}${listId ? `?list=${listId}` : ""}`;
      if (listId)  return `https://www.youtube.com/embed/videoseries?list=${listId}`;
    }
    return url;
  } catch { return ""; }
}

document.getElementById("form-musicas")?.addEventListener("submit", async e => {
  e.preventDefault();
  const title     = document.getElementById("mTitle")?.value.trim();
  const linkInput = document.getElementById("mLink")?.value.trim();
  if (!title || !linkInput) return;

  const src = extractIframeSrc(linkInput);
  if (!src) { alert("URL ou código iframe inválido."); return; }

  const btn  = document.getElementById("btn-add-musicas");
  const orig = btn?.innerHTML ?? "";
  if (btn) btn.innerHTML = "<span>Adicionando…</span>";

  try {
    await push(dbRefs.musicas, { title, src, timestamp: Date.now() });
    document.getElementById("form-musicas")?.reset();
  } catch (err) {
    console.error("[musicas] Falha ao salvar:", err.message);
    alert("Erro ao salvar. Tente novamente.");
  } finally {
    if (btn) btn.innerHTML = orig;
  }
});

function renderMusicas() {
  const track = document.getElementById("list-musicas");
  const items = state.musicas.items;
  if (!track) return;

  if (!items.length) {
    track.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p class="empty-text">Aguardando playlists…</p></div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = "musica-card";
    card.innerHTML = `
      <div class="musica-card-header">
        <h3 class="musica-title">${m.title}</h3>
        <button class="movie-action-btn delete" onclick="window.deleteItem('musicas','${m.key}')" aria-label="Deletar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="musica-iframe-wrapper">
        <iframe allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" frameborder="0" height="450" style="width:100%;max-width:660px;overflow:hidden;border-radius:10px;" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" src="${m.src}" loading="lazy"></iframe>
      </div>`;
    fragment.appendChild(card);
    if (typeof gsap !== "undefined") gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", delay: idx * 0.1 });
  });

  track.innerHTML = "";
  track.appendChild(fragment);
}

// ─── Abas de Filtro ───────────────────────────────────────────────────────────
document.querySelectorAll(".ftab").forEach(tab => {
  tab.addEventListener("click", e => {
    const section = e.target.dataset.section;
    if (!section || section === "musicas") return;

    document.querySelectorAll(`.ftab[data-section="${section}"]`).forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");
    state[section].filter = e.target.dataset.filter;
    renderItems(section);
  });
});

// ─── Abas Principais ──────────────────────────────────────────────────────────
document.querySelectorAll(".main-tab").forEach(tab => {
  tab.addEventListener("click", e => {
    const section = e.currentTarget.dataset.section;

    document.querySelectorAll(".main-tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    e.currentTarget.classList.add("active");
    e.currentTarget.setAttribute("aria-selected", "true");

    document.querySelectorAll(".media-section").forEach(s => {
      const id = s.id.replace("section-", "");
      s.classList.remove("active");
      window.stopAutoplay(id);
    });

    document.getElementById(`section-${section}`)?.classList.add("active");
    window.startAutoplay(section);
  });
});