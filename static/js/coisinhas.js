import { ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { db } from "/static/js/app.js";

const form = document.getElementById("coisinhaForm");
const input = document.getElementById("coisinhaInput");
const listContainer = document.getElementById("coisinhasList");
const filterBtns = document.querySelectorAll(".filter-btn");

// Elementos opcionais de progresso (atualizados apenas se existirem no HTML)
const progressFill = document.querySelector(".progress-fill, #progressFill-coisinhas, #progressFill");
const progressNumber = document.querySelector(".progress-number, #progressLabel-coisinhas, #progressLabel");

const MAX_TITLE_LENGTH = 120;
const MAX_CONCURRENT_IMAGES = 3;
const FLIP_DURATION_MS = 350;
const FLIP_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";
const FALLBACK_IMG = "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80";

let allCoisinhas = [];
let currentFilter = "all";
let hasLoadedOnce = false;

// Estado de reconciliacao por ID
const cardsMap = new Map();       // id -> HTMLElement (.experience-card)
const deletingIds = new Set();    // ids em processo de exclusao
const editingState = new Map();   // id -> { originalTitle, pendingItem }
let emptyStateEl = null;

// Controle de fila de carregamento de imagens (evita rate-limit da Pollinations)
let activeImageLoads = 0;
const imageLoadQueue = [];

if (input) {
  input.setAttribute("maxlength", String(MAX_TITLE_LENGTH));
}
if (listContainer && !listContainer.hasAttribute("aria-live")) {
  listContainer.setAttribute("aria-live", "polite");
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sanitizeTitle(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_TITLE_LENGTH);
}

function getValidCustomImage(item) {
  const candidate = item.imageUrl || item.image || item.img || item.foto || "";
  if (typeof candidate !== "string" || !candidate.trim()) return "";
  const trimmed = candidate.trim();

  if (trimmed.includes("source.unsplash.com")) return "";
  if (trimmed.startsWith("data:image/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return parsed.href;
  } catch {
    return "";
  }
  return "";
}

/**
 * Decisao de imagem documentada:
 * - Se o item possuir uma URL customizada valida (https: ou data:image/), ela tem prioridade.
 * - Caso contrario, a imagem e gerada via Pollinations usando o titulo e o seed fixo de createdAt.
 * - Se o usuario editar o titulo de um item cuja imagem era gerada por IA, a chave de assinatura muda
 *   e uma nova imagem correspondente ao novo titulo e carregada. Mudar 'done' nao recarrega a imagem.
 */
function buildImageSource(item) {
  const customImg = getValidCustomImage(item);
  if (customImg) {
    return { src: customImg, signature: `custom::${customImg}` };
  }
  const safeTitle = sanitizeTitle(item.title) || "romantic moment";
  const seed = item.createdAt ? String(item.createdAt).slice(-4) : "1234";
  const aiPrompt = encodeURIComponent(`${safeTitle}, romantic couples aesthetic photography, cinematic, 4k`);
  const generatedUrl = `https://image.pollinations.ai/prompt/${aiPrompt}?width=600&height=400&seed=${seed}&nologo=true`;
  return { src: generatedUrl, signature: `ai::${safeTitle}::${seed}` };
}

function enqueueImageLoad(imgEl, wrapperEl, targetSrc) {
  imageLoadQueue.push({ imgEl, wrapperEl, targetSrc });
  processImageQueue();
}

function processImageQueue() {
  while (activeImageLoads < MAX_CONCURRENT_IMAGES && imageLoadQueue.length > 0) {
    const task = imageLoadQueue.shift();
    if (!task.imgEl.isConnected) continue;

    activeImageLoads++;
    task.imgEl.dataset.TargetSrc = task.targetSrc;
    task.imgEl.src = task.targetSrc;
  }
}

function setupCardImage(wrapperEl, imgEl, item) {
  const { src, signature } = buildImageSource(item);
  if (wrapperEl.dataset.imgSignature === signature) return;

  wrapperEl.dataset.imgSignature = signature;
  wrapperEl.classList.add("is-loading");
  wrapperEl.classList.remove("is-loaded");
  delete imgEl.dataset.fallbackApplied;

  enqueueImageLoad(imgEl, wrapperEl, src);
}

function attachImageEvents(wrapperEl, imgEl) {
  let slotReleased = false;
  const releaseSlot = () => {
    if (!slotReleased) {
      slotReleased = true;
      activeImageLoads = Math.max(0, activeImageLoads - 1);
      processImageQueue();
    }
  };

  imgEl.addEventListener("load", () => {
    wrapperEl.classList.remove("is-loading");
    wrapperEl.classList.add("is-loaded");
    releaseSlot();
  });

  imgEl.addEventListener("error", () => {
    if (!imgEl.dataset.fallbackApplied) {
      imgEl.dataset.fallbackApplied = "true";
      imgEl.src = FALLBACK_IMG;
    } else {
      wrapperEl.classList.remove("is-loading");
      wrapperEl.classList.add("is-loaded");
    }
    releaseSlot();
  });
}

function createSvgIcon(type) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");

  if (type === "edit") {
    const path1 = document.createElementNS(ns, "path");
    path1.setAttribute("d", "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7");
    const path2 = document.createElementNS(ns, "path");
    path2.setAttribute("d", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z");
    svg.appendChild(path1);
    svg.appendChild(path2);
  } else if (type === "delete") {
    const line1 = document.createElementNS(ns, "line");
    line1.setAttribute("x1", "18");
    line1.setAttribute("y1", "6");
    line1.setAttribute("x2", "6");
    line1.setAttribute("y2", "18");
    const line2 = document.createElementNS(ns, "line");
    line2.setAttribute("x1", "6");
    line2.setAttribute("y1", "6");
    line2.setAttribute("x2", "18");
    line2.setAttribute("y2", "18");
    svg.appendChild(line1);
    svg.appendChild(line2);
  }
  return svg;
}

function createCardElement(item, staggerIndex = 0) {
  const safeTitle = sanitizeTitle(item.title) || "Sem titulo";

  const card = document.createElement("div");
  card.className = `experience-card${item.done ? " done" : ""}`;
  card.setAttribute("data-id", item.id);

  if (!prefersReducedMotion()) {
    card.classList.add("is-entering");
    card.style.animationDelay = `${Math.min(staggerIndex * 60, 360)}ms`;
    card.addEventListener("animationend", (ev) => {
      if (ev.animationName === "cardEnter") {
        card.classList.remove("is-entering");
        card.style.animationDelay = "";
      }
    }, { once: true });
  }

  // Acoes
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const btnEdit = document.createElement("button");
  btnEdit.type = "button";
  btnEdit.className = "action-btn btn-edit";
  btnEdit.setAttribute("aria-label", `Editar ${safeTitle}`);
  btnEdit.appendChild(createSvgIcon("edit"));

  const btnDelete = document.createElement("button");
  btnDelete.type = "button";
  btnDelete.className = "action-btn btn-delete";
  btnDelete.setAttribute("aria-label", `Remover ${safeTitle}`);
  btnDelete.appendChild(createSvgIcon("delete"));

  actions.appendChild(btnEdit);
  actions.appendChild(btnDelete);

  // Imagem
  const imageWrapper = document.createElement("div");
  imageWrapper.className = "card-image is-loading";

  const img = document.createElement("img");
  img.setAttribute("alt", safeTitle);
  img.setAttribute("loading", "lazy");
  img.setAttribute("decoding", "async");
  img.setAttribute("referrerpolicy", "no-referrer");

  attachImageEvents(imageWrapper, img);
  imageWrapper.appendChild(img);
  setupCardImage(imageWrapper, img, item);

  // Conteudo
  const content = document.createElement("div");
  content.className = "card-content";

  const titleSpan = document.createElement("span");
  titleSpan.className = "item-name";
  titleSpan.textContent = safeTitle;

  const label = document.createElement("label");
  label.className = "item-checkbox-container";
  label.setAttribute("aria-label", `Marcar ${safeTitle} como concluida`);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "elegant-checkbox";
  checkbox.checked = Boolean(item.done);

  const checkmark = document.createElement("span");
  checkmark.className = "checkmark";

  label.appendChild(checkbox);
  label.appendChild(checkmark);

  content.appendChild(titleSpan);
  content.appendChild(label);

  card.appendChild(actions);
  card.appendChild(imageWrapper);
  card.appendChild(content);

  return card;
}

function updateCardElementInPlace(card, item) {
  // Se este card estiver em edicao ativa no momento, guarda o item pendente para aplicar ao sair
  if (editingState.has(item.id)) {
    editingState.get(item.id).pendingItem = item;
    return;
  }

  const safeTitle = sanitizeTitle(item.title) || "Sem titulo";
  const isDone = Boolean(item.done);

  card.classList.toggle("done", isDone);

  const checkbox = card.querySelector(".elegant-checkbox");
  if (checkbox && checkbox.checked !== isDone) {
    checkbox.checked = isDone;
  }

  const titleSpan = card.querySelector(".item-name");
  if (titleSpan && titleSpan.textContent !== safeTitle) {
    titleSpan.textContent = safeTitle;
  }

  const imgWrapper = card.querySelector(".card-image");
  const img = imgWrapper?.querySelector("img");
  if (img && img.getAttribute("alt") !== safeTitle) {
    img.setAttribute("alt", safeTitle);
  }
  if (imgWrapper && img) {
    setupCardImage(imgWrapper, img, item);
  }

  const btnEdit = card.querySelector(".btn-edit");
  const btnDelete = card.querySelector(".btn-delete");
  const checkLabel = card.querySelector(".item-checkbox-container");
  if (btnEdit) btnEdit.setAttribute("aria-label", `Editar ${safeTitle}`);
  if (btnDelete) btnDelete.setAttribute("aria-label", `Remover ${safeTitle}`);
  if (checkLabel) checkLabel.setAttribute("aria-label", `Marcar ${safeTitle} como concluida`);
}

function animateCardRemoval(card) {
  return new Promise((resolve) => {
    if (!card || !card.isConnected || prefersReducedMotion()) {
      card?.remove();
      resolve();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      card.removeEventListener("transitionend", onEnd);
      card.removeEventListener("animationend", onEnd);
      card.remove();
      resolve();
    };

    const onEnd = (e) => {
      if (e.target === card) done();
    };

    card.addEventListener("transitionend", onEnd);
    card.addEventListener("animationend", onEnd);
    card.classList.remove("is-entering");
    card.classList.add("is-leaving");

    setTimeout(done, 420);
  });
}

function updateProgressBar() {
  if (!progressFill && !progressNumber) return;

  const total = allCoisinhas.length;
  const doneCount = allCoisinhas.filter(item => Boolean(item.done)).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (progressNumber) {
    progressNumber.textContent = `${doneCount} / ${total}`;
  }
  if (progressFill) {
    progressFill.style.width = `${pct}%`;
  }
}

function updateEmptyState(isEmpty) {
  if (!listContainer) return;

  if (isEmpty) {
    if (!emptyStateEl) {
      emptyStateEl = document.createElement("div");
      emptyStateEl.className = "empty-menu is-hidden";
      emptyStateEl.textContent = "Nenhuma experiencia encontrada nesta categoria.";
    }
    if (!emptyStateEl.isConnected) {
      listContainer.appendChild(emptyStateEl);
      requestAnimationFrame(() => {
        emptyStateEl?.classList.remove("is-hidden");
      });
    } else {
      emptyStateEl.classList.remove("is-hidden");
    }
  } else if (emptyStateEl && emptyStateEl.isConnected) {
    const elToRemove = emptyStateEl;
    elToRemove.classList.add("is-hidden");
    setTimeout(() => {
      if (cardsMap.size > 0 && elToRemove.isConnected) {
        elToRemove.remove();
      }
    }, 220);
  }
}

// 1. ADICIONAR NOVA EXPERIENCIA
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = sanitizeTitle(input?.value || "");
  if (!title) return;

  try {
    await push(ref(db, "coisinhas"), {
      title,
      done: false,
      createdAt: Date.now()
    });
    if (input) {
      input.value = "";
      input.focus();
    }
  } catch (error) {
    console.error("Erro ao registrar a experiencia:", error);
  }
});

// 2. ESCUTAR DADOS EM TEMPO REAL
onValue(ref(db, "coisinhas"), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    allCoisinhas = [];
  } else {
    allCoisinhas = Object.entries(data).map(([id, val]) => ({ id, ...val }));
  }
  updateProgressBar();
  reconcileCards();
  hasLoadedOnce = true;
});

// 3. FILTROS (usando e.currentTarget e aria-pressed)
filterBtns.forEach((btn) => {
  const isInitiallyActive = btn.classList.contains("active");
  btn.setAttribute("aria-pressed", String(isInitiallyActive));

  btn.addEventListener("click", (e) => {
    const clickedBtn = e.currentTarget;
    const nextFilter = clickedBtn.getAttribute("data-filter") || "all";
    if (nextFilter === currentFilter) return;

    filterBtns.forEach((b) => {
      const active = b === clickedBtn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });

    currentFilter = nextFilter;
    reconcileCards();
  });
});

// 4. RECONCILIACAO DE CARTOES COM ANIMACAO FLIP E FILA DE IMAGENS
function reconcileCards() {
  if (!listContainer) return;

  const filteredItems = allCoisinhas
    .filter((item) => {
      if (currentFilter === "pending") return !item.done;
      if (currentFilter === "done") return Boolean(item.done);
      return true;
    })
    .sort((a, b) => {
      if (Boolean(a.done) === Boolean(b.done)) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return a.done ? 1 : -1;
    });

  const targetIds = new Set(filteredItems.map((i) => i.id));

  // First: medir posicoes atuais dos cartoes que continuarao visiveis (FLIP)
  const firstRects = new Map();
  if (hasLoadedOnce && !prefersReducedMotion()) {
    cardsMap.forEach((card, id) => {
      if (targetIds.has(id) && card.isConnected && !card.classList.contains("is-leaving")) {
        firstRects.set(id, card.getBoundingClientRect());
      }
    });
  }

  // Remover cartoes que sairam do filtro ou foram excluidos no Firebase
  cardsMap.forEach((card, id) => {
    if (!targetIds.has(id)) {
      cardsMap.delete(id);
      editingState.delete(id);
      animateCardRemoval(card);
    }
  });

  // Atualizar existentes ou criar novos na ordem correta
  let newCardStagger = 0;
  filteredItems.forEach((item) => {
    let card = cardsMap.get(item.id);

    if (card) {
      updateCardElementInPlace(card, item);
    } else {
      card = createCardElement(item, newCardStagger++);
      cardsMap.set(item.id, card);
    }

    // Reordenar no DOM sem recriar nos (preserva estado do img e foco)
    listContainer.appendChild(card);
  });

  updateEmptyState(filteredItems.length === 0);

  // Last + Invert + Play (FLIP para reordenacao suave quando concluidos descem/sobem)
  if (firstRects.size > 0 && !prefersReducedMotion()) {
    firstRects.forEach((firstRect, id) => {
      const card = cardsMap.get(id);
      if (!card || !card.isConnected) return;

      const lastRect = card.getBoundingClientRect();
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        card.classList.add("is-moving");
        const anim = card.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" }
          ],
          {
            duration: FLIP_DURATION_MS,
            easing: FLIP_EASING
          }
        );
        anim.onfinish = () => card.classList.remove("is-moving");
        anim.oncancel = () => card.classList.remove("is-moving");
      }
    });
  }
}

function pulseCardOnSave(card) {
  if (!card || prefersReducedMotion()) return;
  card.classList.remove("is-pulsing");
  void card.offsetWidth;
  card.classList.add("is-pulsing");
  card.addEventListener("animationend", () => {
    card.classList.remove("is-pulsing");
  }, { once: true });
}

// 5. INTERACOES: Checkbox, Deletar e Editar via Delegacao
listContainer?.addEventListener("change", async (e) => {
  const checkbox = e.target.closest(".elegant-checkbox");
  if (!checkbox) return;

  const card = checkbox.closest(".experience-card");
  const id = card?.getAttribute("data-id");
  if (!id || deletingIds.has(id)) return;

  try {
    await update(ref(db, `coisinhas/${id}`), { done: checkbox.checked });
  } catch (error) {
    console.error("Erro ao atualizar status da experiencia:", error);
    checkbox.checked = !checkbox.checked;
  }
});

listContainer?.addEventListener("click", async (e) => {
  // Acao de Deletar com bloqueio de clique duplo e restauracao em caso de falha
  const deleteBtn = e.target.closest(".btn-delete");
  if (deleteBtn) {
    const card = deleteBtn.closest(".experience-card");
    const id = card?.getAttribute("data-id");
    if (!id || deletingIds.has(id)) return;

    deletingIds.add(id);
    deleteBtn.disabled = true;

    try {
      await animateCardRemoval(card);
      cardsMap.delete(id);
      editingState.delete(id);
      await remove(ref(db, `coisinhas/${id}`));
    } catch (error) {
      console.error("Falha ao remover experiencia:", error);
      deleteBtn.disabled = false;
      card.classList.remove("is-leaving");
      if (!card.isConnected && listContainer) {
        listContainer.appendChild(card);
        cardsMap.set(id, card);
      }
      alert("Nao foi possivel remover este item. Verifique sua conexao e tente novamente.");
    } finally {
      deletingIds.delete(id);
    }
    return;
  }

  // Acao de Editar com DOM API, Enter/Escape e protecao contra atualizacoes concorrentes
  const editBtn = e.target.closest(".btn-edit");
  if (editBtn) {
    const card = editBtn.closest(".experience-card");
    const id = card?.getAttribute("data-id");
    if (!id || deletingIds.has(id) || editingState.has(id)) return;

    const titleContainer = card.querySelector(".item-name");
    if (!titleContainer) return;

    const currentTitle = titleContainer.textContent || "";
    editingState.set(id, { originalTitle: currentTitle, pendingItem: null });

    const inputField = document.createElement("input");
    inputField.type = "text";
    inputField.className = "edit-input";
    inputField.maxLength = MAX_TITLE_LENGTH;
    inputField.value = currentTitle;
    inputField.setAttribute("aria-label", "Editar titulo da experiencia");

    titleContainer.textContent = "";
    titleContainer.appendChild(inputField);

    inputField.focus();
    inputField.setSelectionRange(inputField.value.length, inputField.value.length);

    let isFinished = false;

    const finishEdit = async (shouldSave) => {
      if (isFinished) return;
      isFinished = true;

      const stateEntry = editingState.get(id);
      editingState.delete(id);

      const newTitle = sanitizeTitle(inputField.value);
      const changed = shouldSave && newTitle.length > 0 && newTitle !== currentTitle;

      if (changed) {
        titleContainer.textContent = newTitle;
        pulseCardOnSave(card);
        try {
          await update(ref(db, `coisinhas/${id}`), { title: newTitle });
        } catch (error) {
          console.error("Erro ao salvar edicao:", error);
          titleContainer.textContent = currentTitle;
        }
      } else {
        const fallbackTitle = stateEntry?.pendingItem
          ? sanitizeTitle(stateEntry.pendingItem.title)
          : currentTitle;
        titleContainer.textContent = fallbackTitle || currentTitle;
      }

      if (stateEntry?.pendingItem && !changed) {
        updateCardElementInPlace(card, stateEntry.pendingItem);
      }
    };

    inputField.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finishEdit(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finishEdit(false);
      }
    });

    inputField.addEventListener("blur", () => {
      finishEdit(true);
    });
  }
});