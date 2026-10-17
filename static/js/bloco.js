// Bloco de Notas: texto livre, listas e perguntas com resposta.
// Só é carregado quando a sessão está autenticada (ver bloco.html).
// Caminho no banco: "bloco". Cada nota guarda createdAt (momento) e createdDate (dia).
import { db, ref, push, onValue, remove, update } from "/static/js/app.js";
import { escapeHTML } from "/static/js/utils.js";

const $ = id => document.getElementById(id);
const DB_PATH = "bloco";
const notasRef = ref(db, DB_PATH);
const TOTAL_STEPS = 3;
const TYPES = ["texto", "lista", "pergunta"];
const TYPE_LABEL = { texto: "Texto livre", lista: "Lista", pergunta: "Pergunta" };
const FALLBACK_IMG = "https://placehold.co/1600x1080/d4e6f6/3f6fa6?text=Memoria+Guardada";

const ICONS = {
  texto: '<svg class="note-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  lista: '<svg class="note-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
  pergunta: '<svg class="note-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
};

const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
const ICON_DEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

let notes = [];
let currentFilter = "todos";
let currentMStep = 1;
let qaIndex = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Data da nota: createdAt (novas) ou timestamp (notas antigas).
function noteTime(n) {
  const ts = n.createdAt ?? n.timestamp;
  return ts ? new Date(ts) : null;
}

function formatNoteDate(n) {
  const d = noteTime(n);
  if (!d) return "";
  const dia = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} · ${hora}`;
}

function getTargetAnswerer(authorName) {
  const n = (authorName || "").toLowerCase().trim();
  if (n === "hesron") return "Tiago";
  if (n === "tiago") return "Hesron";
  return "Amor";
}

function hasAnswer(n) {
  return (n.answer || "").trim() !== "";
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function getThemeImage(title) {
  const safeTitle = (title || "").trim();
  const prompt = `Luxury minimalist clean fine art texture background representing ${safeTitle}, soft ivory and gold geometric layout, high-end design pattern, 8k resolution`;
  const seed = Math.abs(hashCode(safeTitle));
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1600&height=1080&seed=${seed}`;
}

const nl2br = s => escapeHTML(s).replace(/\n/g, "<br>");

// ─── Formulário em passos ─────────────────────────────────────────────────────

function selectedValue(name, fallback) {
  const r = document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : fallback;
}

function updateMFormUI() {
  document.querySelectorAll(".mform-step").forEach(s => {
    const n = Number(s.dataset.step);
    const ativo = n === currentMStep;
    s.style.display = ativo ? "block" : "none";
    s.classList.toggle("active", ativo);
    s.classList.toggle("done", n < currentMStep);
  });

  document.querySelectorAll(".mstep").forEach(s => {
    const n = Number(s.dataset.step);
    s.classList.toggle("active", n === currentMStep);
    s.classList.toggle("done", n < currentMStep);
  });

  const pct = ((currentMStep - 1) / (TOTAL_STEPS - 1)) * 100;
  $("mformProgress").style.width = pct + "%";

  if (currentMStep === 3) {
    const type = selectedValue("nType", "texto");
    const author = selectedValue("nAuthor", "");
    const outra = author === "Hesron" ? "Tiago" : (author === "Tiago" ? "Hesron" : "a outra pessoa");

    const pergunta = type === "pergunta";
    $("mform-step3-title").textContent =
      pergunta ? "Qual é a sua pergunta?" : (type === "lista" ? "Monte a sua lista" : "Escreva o conteúdo");
    $("field-content").style.display = pergunta ? "none" : "block";
    $("field-answer-hint").style.display = pergunta ? "flex" : "none";
    $("hint-text").textContent = `${outra} vai responder em breve`;
    $("label-content").textContent = type === "lista" ? "Itens (um por linha)..." : "Conteúdo...";
  }
}

function bindForm() {
  document.querySelectorAll(".mform-btn-next").forEach(b => b.addEventListener("click", () => {
    if (currentMStep < TOTAL_STEPS) { currentMStep++; updateMFormUI(); }
  }));
  document.querySelectorAll(".mform-btn-back").forEach(b => b.addEventListener("click", () => {
    if (currentMStep > 1) { currentMStep--; updateMFormUI(); }
  }));

  document.querySelectorAll(".mform-textarea").forEach(ta => {
    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
  });

  $("note-form").addEventListener("submit", async e => {
    e.preventDefault();
    const type = selectedValue("nType", "texto");
    const author = selectedValue("nAuthor", "");
    const title = $("nTitle").value.trim();
    const content = type === "pergunta" ? "" : $("nContent").value.trim();
    if (!title || (!content && type !== "pergunta")) return;

    const btn = $("btn-note-submit");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "<span>Gravando...</span>";

    try {
      await push(notasRef, {
        title, type, author, content, answer: "",
        createdAt: Date.now(),
        createdDate: todayISO(),
      });
      $("note-form").reset();
      document.querySelector('input[name="nType"]').checked = true;
      document.querySelectorAll('input[name="nAuthor"]').forEach(r => { r.checked = false; });
      $("nContent").style.height = "auto";
      currentMStep = 1;
      updateMFormUI();
    } catch (err) {
      console.error("[bloco] Erro ao gravar:", err);
      alert("Não consegui gravar a nota. Tente de novo.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}

// ─── Renderização ─────────────────────────────────────────────────────────────

function answerBlockHTML(n) {
  const expected = getTargetAnswerer(n.author);
  if (hasAnswer(n)) {
    return `
      <div class="note-qa">
        <p class="note-qa-label">✦ resposta de ${escapeHTML(n.answeredBy || expected)}</p>
        <p class="note-answer">“${nl2br(n.answer)}”</p>
      </div>`;
  }
  return `
    <div class="note-qa note-qa-pending">
      <p class="note-qa-label">✦ aguardando resposta de ${escapeHTML(expected)}</p>
      <form class="answer-form" data-key="${escapeHTML(n.key)}" data-answerer="${escapeHTML(expected)}">
        <textarea class="answer-input" rows="2" placeholder="${escapeHTML(expected)}, responda aqui..." aria-label="Resposta de ${escapeHTML(expected)}"></textarea>
        <button type="submit" class="btn-answer">Responder</button>
      </form>
    </div>`;
}

function actionsHTML(key) {
  return `
    <div class="note-actions">
      <button type="button" class="btn-action" data-action="edit" data-key="${escapeHTML(key)}" title="Editar" aria-label="Editar">${ICON_EDIT}</button>
      <button type="button" class="btn-action del" data-action="delete" data-key="${escapeHTML(key)}" title="Apagar" aria-label="Apagar">${ICON_DEL}</button>
    </div>`;
}

function noteBodyHTML(n) {
  if (n.type === "lista") {
    const items = (n.content || "").split("\n").filter(x => x.trim());
    return `<ul class="note-list">${items.map(x => `<li>${escapeHTML(x)}</li>`).join("")}</ul>`;
  }
  if (n.type === "pergunta") return answerBlockHTML(n);
  return `<p class="note-text">${nl2br(n.content || "")}</p>`;
}

function noteCardHTML(n, i) {
  const type = TYPES.includes(n.type) ? n.type : "texto";
  const d = noteTime(n);
  const dateAttr = d ? ` datetime="${d.toISOString()}"` : "";
  return `
    <article class="note-card type-${type}" style="--i:${i}">
      <header class="note-head">
        <span class="note-badge">${ICONS[type]}<span>${TYPE_LABEL[type]}</span></span>
        ${n.author ? `<span class="note-author">por ${escapeHTML(n.author)}</span>` : ""}
      </header>
      <h3 class="note-title">${escapeHTML(n.title)}</h3>
      <div class="note-body">${noteBodyHTML(n)}</div>
      <footer class="note-footer">
        <time class="note-date"${dateAttr}>${escapeHTML(formatNoteDate(n))}</time>
        ${actionsHTML(n.key)}
      </footer>
    </article>`;
}

function renderNotes() {
  const list = $("notesList");
  const filtered = notes.filter(n => currentFilter === "todos" || n.type === currentFilter);
  if (!filtered.length) {
    list.innerHTML = `<p class="notes-empty">O grimório está vazio. Escreva algo...</p>`;
    return;
  }
  list.innerHTML = filtered.map((n, i) => noteCardHTML(n, i)).join("");
}

// ─── Carrossel de perguntas ───────────────────────────────────────────────────

function qaSlideHTML(n) {
  return `
    <li class="qa-slide" role="group" aria-roledescription="slide">
      <div class="qa-card">
        <img class="qa-card-bg" src="${escapeHTML(getThemeImage(n.title))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';">
        <div class="qa-card-inner">
          <p class="qa-who">${escapeHTML(n.author || "Alguém")} perguntou</p>
          <h3 class="qa-question">${escapeHTML(n.title)}</h3>
          <time class="qa-date">${escapeHTML(formatNoteDate(n))}</time>
          ${answerBlockHTML(n)}
          <div class="qa-footer">${actionsHTML(n.key)}</div>
        </div>
      </div>
    </li>`;
}

function setQAVisible(visible) {
  $("qaControls").hidden = !visible;
}

function goQA(i) {
  const slides = $("qaTrack").children.length;
  if (!slides) return;
  qaIndex = Math.min(Math.max(i, 0), slides - 1);
  $("qaTrack").style.transform = `translateX(${-qaIndex * 100}%)`;

  [...$("qaTrack").children].forEach((li, idx) => {
    li.setAttribute("aria-hidden", String(idx !== qaIndex));
  });
  [...$("qaDots").children].forEach((dot, idx) => {
    dot.classList.toggle("active", idx === qaIndex);
    dot.setAttribute("aria-current", String(idx === qaIndex));
  });

  $("qaCounter").textContent = `${qaIndex + 1} / ${slides}`;
  $("qaPrev").disabled = qaIndex === 0;
  $("qaNext").disabled = qaIndex === slides - 1;
}

function renderQA() {
  const perguntas = notes.filter(n => n.type === "pergunta");
  const track = $("qaTrack");
  const dots = $("qaDots");

  if (!perguntas.length) {
    track.innerHTML = `<li class="qa-empty"><p>Nenhuma pergunta por enquanto.</p></li>`;
    dots.innerHTML = "";
    $("qaCounter").textContent = "";
    setQAVisible(false);
    qaIndex = 0;
    return;
  }

  setQAVisible(perguntas.length > 1);
  track.innerHTML = perguntas.map(qaSlideHTML).join("");
  dots.innerHTML = perguntas.map((_, i) =>
    `<button type="button" class="qa-dot" data-index="${i}" aria-label="Pergunta ${i + 1}"></button>`
  ).join("");
  goQA(Math.min(qaIndex, perguntas.length - 1));
}

function renderInterface() {
  const isQ = currentFilter === "pergunta";
  $("notesList").hidden = isQ;
  $("qaCarousel").hidden = !isQ;
  if (isQ) renderQA();
  else renderNotes();
}

// ─── Respostas, edição e exclusão ─────────────────────────────────────────────

async function sendAnswer(form) {
  const answer = form.querySelector("textarea").value.trim();
  if (!answer) return;
  const btn = form.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    await update(ref(db, `${DB_PATH}/${form.dataset.key}`), {
      answer,
      answeredBy: form.dataset.answerer,
      answeredAt: Date.now(),
    });
  } catch (err) {
    console.error("[bloco] Erro ao responder:", err);
    btn.disabled = false;
    btn.textContent = "Responder";
    alert("Não consegui enviar a resposta.");
  }
}

function toggleEditFields() {
  const isP = $("edit-nType").value === "pergunta";
  $("edit-field-content").style.display = isP ? "none" : "";
  $("edit-field-answer").style.display = isP ? "" : "none";
}

function openEdit(key) {
  const n = notes.find(x => x.key === key);
  if (!n) return;
  $("edit-nKey").value = n.key;
  $("edit-nTitle").value = n.title || "";
  $("edit-nType").value = n.type || "texto";
  $("edit-nAuthor").value = n.author || "";
  $("edit-nContent").value = n.content || "";
  $("edit-nAnswer").value = n.answer || "";
  toggleEditFields();
  $("edit-dialog-note").showModal();
}

async function deleteNote(key) {
  try {
    await remove(ref(db, `${DB_PATH}/${key}`));
  } catch (err) {
    console.error("[bloco] Erro ao apagar:", err);
    alert("Não consegui apagar a nota.");
  }
}

function bindActions() {
  // Botões de editar/apagar em qualquer lugar (lista e carrossel)
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, key } = btn.dataset;
    if (action === "edit") openEdit(key);
    else if (action === "delete") deleteNote(key);
  });

  // Respostas (formulários em qualquer card)
  document.addEventListener("submit", e => {
    if (!e.target.matches(".answer-form")) return;
    e.preventDefault();
    sendAnswer(e.target);
  });

  $("edit-nType").addEventListener("change", toggleEditFields);

  $("edit-note-form").addEventListener("submit", async e => {
    e.preventDefault();
    const key = $("edit-nKey").value;
    const type = $("edit-nType").value;
    const isP = type === "pergunta";
    try {
      await update(ref(db, `${DB_PATH}/${key}`), {
        title: $("edit-nTitle").value.trim(),
        type,
        author: $("edit-nAuthor").value.trim(),
        content: isP ? "" : $("edit-nContent").value.trim(),
        answer: isP ? $("edit-nAnswer").value.trim() : "",
      });
      $("edit-dialog-note").close();
    } catch (err) {
      console.error("[bloco] Erro ao editar:", err);
      alert("Não consegui salvar a alteração.");
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach(b =>
    b.addEventListener("click", () => $(b.dataset.closeDialog).close())
  );
}

function bindFilters() {
  document.querySelectorAll(".ftab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ftab").forEach(t => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", String(on));
      });
      currentFilter = tab.dataset.filter;
      renderInterface();
    });
  });
}

function bindCarousel() {
  $("qaPrev").addEventListener("click", () => goQA(qaIndex - 1));
  $("qaNext").addEventListener("click", () => goQA(qaIndex + 1));
  $("qaDots").addEventListener("click", e => {
    const dot = e.target.closest(".qa-dot");
    if (dot) goQA(Number(dot.dataset.index));
  });

  // Arrastar com o dedo (celular)
  const viewport = $("qaViewport");
  let startX = 0, startY = 0, dragging = false;
  viewport.addEventListener("touchstart", e => {
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  viewport.addEventListener("touchend", e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goQA(qaIndex + (dx < 0 ? 1 : -1));
  });
  viewport.addEventListener("touchcancel", () => { dragging = false; });

  // Setas do teclado (só no filtro de perguntas e sem campo em foco)
  document.addEventListener("keydown", e => {
    if (currentFilter !== "pergunta") return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (e.key === "ArrowRight") goQA(qaIndex + 1);
    if (e.key === "ArrowLeft") goQA(qaIndex - 1);
  });
}

// ─── Inicialização ────────────────────────────────────────────────────────────

onValue(notasRef, snapshot => {
  notes = [];
  snapshot.forEach(child => { notes.push({ key: child.key, ...child.val() }); });
  notes.reverse();
  renderInterface();
});

updateMFormUI();
bindForm();
bindActions();
bindFilters();
bindCarousel();

if (window.gsap) {
  gsap.fromTo("#bloco-content", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, ease: "power3.out" });
}
