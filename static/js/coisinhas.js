// Coisinhas: lista de experiências com galeria, filtros, progresso e edição.
// Segue a mesma estrutura de filmes.js (estado central, galeria, delegação de eventos).
// A aba de Treino fica em treino.js.
import { db, ref, push, onValue, remove, update } from "/static/js/app.js";
import { escapeHTML } from "/static/js/utils.js";
import { initTreinoModule } from "/static/js/treino.js";

const $ = id => document.getElementById(id);
const DB_PATH = "coisinhas";
const coisinhasRef = ref(db, DB_PATH);
const DEBOUNCE_MS = 700;

const CATEGORIAS = {
  visitar: "Visitar Local",
  comida: "Comida",
  receita: "Fazer Receita",
  drink: "Experimentar Drink",
  outro: "Outro",
};

const FALLBACK_IMG = "https://placehold.co/600x900/d4e6f6/3f6fa6?text=Sem+Capa";

const ICONS = {
  visitar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
  comida: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>',
  receita: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>',
  drink: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"></path><path d="M12 15v7"></path><path d="m3 3 18 0"></path><path d="m3 3 12 15 9-15"></path></svg>',
  outro: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
};

const state = { items: [], filtered: [], currentIndex: 0, filter: "todos" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getThemeImage(title, category) {
  const query = `aesthetic photography ${category || ""} ${(title || "").trim()} pinterest`;
  return `https://tse2.mm.bing.net/th?q=${encodeURIComponent(query)}&w=600&h=900&c=7&rs=1&p=0`;
}

function formatDate(iso) {
  return iso ? String(iso).split("-").reverse().join("/") : "";
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Capa de prévia no formulário ─────────────────────────────────────────────

function setupPreview() {
  const titleInput = $("cTitle");
  const categoryInput = $("cCategory");
  const box = $("poster-preview-box-coisinhas");
  const img = $("poster-preview-img-coisinhas");
  const icon = $("poster-placeholder-icon-coisinhas");

  const showImage = url => {
    img.src = url;
    img.style.display = "block";
    icon.style.display = "none";
  };
  const hideImage = () => {
    img.style.display = "none";
    icon.style.display = "block";
  };

  function run() {
    const title = titleInput.value.trim();
    if (!title) return hideImage();

    box.style.opacity = "0.5";
    const url = getThemeImage(title, categoryInput.value || "outro");
    // Carrega antes de mostrar, para não aparecer imagem quebrada.
    const probe = new Image();
    probe.onload = () => { box.style.opacity = "1"; showImage(url); };
    probe.onerror = () => { box.style.opacity = "1"; showImage(FALLBACK_IMG); };
    probe.src = url;
  }

  const debouncedRun = debounce(run, DEBOUNCE_MS);
  titleInput.addEventListener("input", debouncedRun);
  categoryInput.addEventListener("change", run);
}

function resetPreview() {
  $("poster-preview-img-coisinhas").style.display = "none";
  $("poster-placeholder-icon-coisinhas").style.display = "block";
}

// ─── Progresso ────────────────────────────────────────────────────────────────

function updateProgress() {
  const total = state.items.length;
  const done = state.items.filter(i => i.done === true).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("progressLabel-coisinhas").textContent = `${done} / ${total}`;
  $("progressFill-coisinhas").style.width = `${pct}%`;
}

// ─── Filtro e galeria ─────────────────────────────────────────────────────────

function applyFilter() {
  state.filtered = state.items.filter(i => state.filter === "todos" || i.category === state.filter);
}

function renderItems() {
  const track = $("list-coisinhas");
  const mainView = $("gallery-main-coisinhas");
  const prevBtn = $("slider-prev-coisinhas");
  const nextBtn = $("slider-next-coisinhas");

  const activeKey = state.filtered[state.currentIndex]?.key ?? null;
  applyFilter();

  if (!state.filtered.length) {
    track.innerHTML = "";
    mainView.innerHTML = `
      <div class="empty-state coisinhas-empty">
        <p class="empty-text">Nenhuma coisinha encontrada.</p>
      </div>`;
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  prevBtn.style.display = "flex";
  nextBtn.style.display = "flex";

  const fragment = document.createDocumentFragment();
  state.filtered.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = `slider-card${m.done ? " watched" : ""}`;
    card.dataset.idx = idx;
    card.innerHTML = `<img src="${escapeHTML(m.poster || FALLBACK_IMG)}" loading="lazy" class="slider-card-img" alt="${escapeHTML(m.title)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">`;
    fragment.appendChild(card);
  });
  track.innerHTML = "";
  track.appendChild(fragment);

  const newIndex = activeKey ? state.filtered.findIndex(m => m.key === activeKey) : -1;
  state.currentIndex = newIndex !== -1 ? newIndex : 0;
  updateSlider(0);
}

function buildMainHTML(m) {
  const done = m.done === true;
  const img = m.poster || FALLBACK_IMG;
  const meta = [CATEGORIAS[m.category] || CATEGORIAS.outro, formatDate(m.targetDate)]
    .filter(Boolean)
    .map(escapeHTML)
    .join(" · ");

  return `
    <div class="gallery-main-blur-bg" style="background-image: url('${escapeHTML(img)}')"></div>
    <img src="${escapeHTML(img)}" class="gallery-main-img" alt="${escapeHTML(m.title)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
    <div class="gallery-main-overlay">
      <h3 class="gallery-main-title${done ? " is-done" : ""}">${escapeHTML(m.title)}</h3>
      <div class="gallery-main-meta">${ICONS[m.category] || ICONS.outro}<span>${meta}</span></div>
      ${m.notes ? `<p class="coisinha-notes">${escapeHTML(m.notes)}</p>` : ""}
      <div class="actions-group">
        <button type="button" class="movie-action-btn check${done ? " checked" : ""}" data-action="toggle" data-key="${escapeHTML(m.key)}" aria-label="${done ? "Desmarcar" : "Marcar como feito"}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button type="button" class="movie-action-btn edit" data-action="edit" data-key="${escapeHTML(m.key)}" aria-label="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button type="button" class="movie-action-btn delete" data-action="delete" data-key="${escapeHTML(m.key)}" aria-label="Deletar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>`;
}

function updateSlider(direction = 0) {
  const mainView = $("gallery-main-coisinhas");
  const cards = document.querySelectorAll("#list-coisinhas .slider-card");

  cards.forEach((card, idx) => card.classList.toggle("active", idx === state.currentIndex));

  const m = state.filtered[state.currentIndex];
  if (!m) return;

  mainView.innerHTML = buildMainHTML(m);

  if (typeof gsap !== "undefined") {
    const img = mainView.querySelector(".gallery-main-img");
    const blurBg = mainView.querySelector(".gallery-main-blur-bg");
    const overlay = mainView.querySelector(".gallery-main-overlay");
    const xOffset = direction !== 0 ? direction * 40 : 0;

    if (img) gsap.fromTo(img,
      { opacity: 0, x: xOffset },
      { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", overwrite: "auto" });
    if (blurBg) gsap.fromTo(blurBg,
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: "power2.out", overwrite: "auto" });
    if (overlay) gsap.fromTo(overlay,
      { opacity: 0, y: 15, x: xOffset * 0.5 },
      { opacity: 1, y: 0, x: 0, duration: 0.5, ease: "power2.out", delay: 0.05, overwrite: "auto" });
  }

  cards[state.currentIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

  $("slider-prev-coisinhas").setAttribute("aria-disabled", String(state.currentIndex === 0));
  $("slider-next-coisinhas").setAttribute("aria-disabled", String(state.currentIndex === state.filtered.length - 1));
}

function goTo(index, direction) {
  if (index < 0 || index >= state.filtered.length || index === state.currentIndex) return;
  state.currentIndex = index;
  updateSlider(direction);
}

function prevSlide() {
  if (state.currentIndex > 0) goTo(state.currentIndex - 1, -1);
}

function nextSlide() {
  if (state.currentIndex < state.filtered.length - 1) goTo(state.currentIndex + 1, 1);
}

// ─── Ações (marcar, editar, excluir) ──────────────────────────────────────────

function toggleDone(key) {
  const item = state.items.find(i => i.key === key);
  if (!item) return;
  update(ref(db, `${DB_PATH}/${key}`), { done: !item.done });
}

function deleteItem(key) {
  remove(ref(db, `${DB_PATH}/${key}`));
}

function openEdit(key) {
  const m = state.items.find(i => i.key === key);
  if (!m) return;
  $("edit-coisinhas-key").value = m.key;
  $("edit-coisinhas-poster").value = m.poster || "";
  $("edit-coisinhas-title").value = m.title || "";
  $("edit-coisinhas-category").value = m.category || "outro";
  $("edit-coisinhas-date").value = m.targetDate || "";
  $("edit-coisinhas-notes").value = m.notes || "";
  $("edit-dialog-coisinhas").showModal();
}

// ─── Formulários ──────────────────────────────────────────────────────────────

function bindAddForm() {
  $("form-coisinhas").addEventListener("submit", async e => {
    e.preventDefault();
    const title = $("cTitle").value.trim();
    const category = $("cCategory").value;
    if (!title || !category) return;

    const btn = $("btn-add-coisinhas");
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Adicionando…";

    try {
      await push(coisinhasRef, {
        title,
        category,
        targetDate: $("cTargetDate").value,
        notes: $("cNotes").value.trim(),
        poster: getThemeImage(title, category),
        done: false,
      });
      $("form-coisinhas").reset();
      resetPreview();
    } catch (err) {
      console.error("[coisinhas] Erro ao adicionar:", err);
      alert("Não consegui adicionar. Tente de novo.");
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  $("edit-form-coisinhas").addEventListener("submit", async e => {
    e.preventDefault();
    const key = $("edit-coisinhas-key").value;
    const original = state.items.find(i => i.key === key);
    if (!original) return;

    const newTitle = $("edit-coisinhas-title").value.trim();
    const newCategory = $("edit-coisinhas-category").value;
    // Recalcula a capa só quando o título ou a categoria mudam.
    const keepPoster = $("edit-coisinhas-poster").value;
    const poster = keepPoster && newTitle === original.title && newCategory === original.category
      ? keepPoster
      : getThemeImage(newTitle, newCategory);

    const btn = $("btn-edit-coisinhas-submit");
    const origText = btn.textContent;
    btn.disabled = true;

    try {
      await update(ref(db, `${DB_PATH}/${key}`), {
        title: newTitle,
        category: newCategory,
        targetDate: $("edit-coisinhas-date").value,
        notes: $("edit-coisinhas-notes").value.trim(),
        poster,
      });
      $("edit-dialog-coisinhas").close();
    } catch (err) {
      console.error("[coisinhas] Erro ao editar:", err);
      alert("Não consegui salvar a alteração.");
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

function bindGallery() {
  // Clique numa miniatura
  $("list-coisinhas").addEventListener("click", e => {
    const card = e.target.closest(".slider-card");
    if (!card) return;
    goTo(Number(card.dataset.idx), Number(card.dataset.idx) > state.currentIndex ? 1 : -1);
  });

  // Botões da capa principal (marcar, editar, excluir)
  $("gallery-main-coisinhas").addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, key } = btn.dataset;
    if (action === "toggle") toggleDone(key);
    else if (action === "edit") openEdit(key);
    else if (action === "delete") deleteItem(key);
  });

  $("slider-prev-coisinhas").addEventListener("click", prevSlide);
  $("slider-next-coisinhas").addEventListener("click", nextSlide);

  // Gestos de arrastar na capa principal
  const mainView = $("gallery-main-coisinhas");
  let startX = 0, startY = 0, dragging = false;
  mainView.addEventListener("touchstart", e => {
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  mainView.addEventListener("touchend", e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prevSlide();
      else nextSlide();
    }
  });
  mainView.addEventListener("touchcancel", () => { dragging = false; });

  // Setas do teclado (só quando a seção de coisinhas está ativa e não há campo em foco)
  document.addEventListener("keydown", e => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (!$("section-coisinhas").classList.contains("active")) return;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") prevSlide();
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextSlide();
  });
}

function bindFilters() {
  document.querySelectorAll('.ftab[data-section="coisinhas"]').forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll('.ftab[data-section="coisinhas"]').forEach(t => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", String(on));
      });
      state.filter = tab.dataset.filter;
      renderItems();
    });
  });
}

function bindMainTabs() {
  document.querySelectorAll(".main-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const section = tab.dataset.section;
      document.querySelectorAll(".main-tab").forEach(t => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", String(on));
      });
      document.querySelectorAll(".media-section").forEach(s => {
        s.classList.toggle("active", s.id === `section-${section}`);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ─── Inicialização ────────────────────────────────────────────────────────────

onValue(coisinhasRef, snapshot => {
  state.items = [];
  snapshot.forEach(child => {
    state.items.push({ key: child.key, ...child.val() });
  });
  state.items.reverse();
  updateProgress();
  renderItems();
});

setupPreview();
bindAddForm();
bindGallery();
bindFilters();
bindMainTabs();
initTreinoModule();
