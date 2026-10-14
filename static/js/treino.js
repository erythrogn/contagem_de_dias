// Aba de treino da página Coisinhas: registrar treinos, marcar exercícios feitos e salvar.
// Cada sessão vai para /treinos e aparece no calendário no dia em que foi feita.
import { db, ref, push, onValue, update, remove } from "/static/js/app.js";
import { escapeHTML } from "/static/js/utils.js";

const treinosRef = ref(db, "treinos");
let items = [];
let draft = [];

const pad = n => String(n).padStart(2, "0");

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "Sem data";
}

// Título usado pelo calendário: "Quem · exercício1, exercício2"
export function buildCalendarTitle(who, exercises) {
  const names = exercises.map(e => e.name).filter(Boolean);
  return names.length ? `${who} · ${names.join(", ")}` : (who || "Treino");
}

function renderDraft() {
  const ul = document.getElementById("treino-draft");
  if (!ul) return;
  ul.innerHTML = draft.map((name, i) => `
    <li class="treino-draft-item">
      <span>${escapeHTML(name)}</span>
      <button type="button" class="treino-draft-remove" data-idx="${i}" aria-label="Remover ${escapeHTML(name)}">×</button>
    </li>`).join("");
}

function renderList() {
  const list = document.getElementById("treino-list");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<p class="empty-text">Nenhum treino registrado ainda.</p>`;
    return;
  }
  list.innerHTML = items.map(t => {
    const exercises = t.exercises;
    const done = exercises.filter(e => e.done).length;
    return `
    <article class="treino-card" data-key="${escapeHTML(t.key)}">
      <header class="treino-card-head">
        <div class="treino-meta">
          <span class="treino-date">${escapeHTML(formatDate(t.date))}</span>
          <span class="treino-who">${escapeHTML(t.who)}</span>
        </div>
        <button type="button" class="treino-btn-del" data-action="delete">Excluir</button>
      </header>
      ${t.group ? `<h3 class="treino-group">${escapeHTML(t.group)}</h3>` : ""}
      <ul class="treino-exercises">
        ${exercises.map(e => `
          <li class="treino-ex${e.done ? " is-done" : ""}" data-name="${escapeHTML(e.name)}">
            <label>
              <input type="checkbox" ${e.done ? "checked" : ""}>
              <span>${escapeHTML(e.name)}</span>
            </label>
          </li>`).join("")}
      </ul>
      <footer class="treino-card-foot">
        <span class="treino-progress">${done}/${exercises.length} feitos</span>
        <button type="button" class="treino-btn-save" data-action="save">Salvar</button>
      </footer>
    </article>`;
  }).join("");
}

function addDraftExercise() {
  const input = document.getElementById("treino-ex-input");
  const name = input.value.trim();
  if (!name) return;
  draft.push(name);
  input.value = "";
  input.focus();
  renderDraft();
}

export function initTreinoModule() {
  const form = document.getElementById("treino-form");
  const list = document.getElementById("treino-list");
  const dateInput = document.getElementById("treino-date");
  if (!form || !list || !dateInput) return;

  dateInput.value = todayISO();
  renderDraft();

  document.getElementById("treino-ex-add").addEventListener("click", addDraftExercise);
  document.getElementById("treino-ex-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addDraftExercise(); }
  });

  document.getElementById("treino-draft").addEventListener("click", e => {
    const btn = e.target.closest(".treino-draft-remove");
    if (!btn) return;
    draft.splice(Number(btn.dataset.idx), 1);
    renderDraft();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const date = dateInput.value;
    const who = document.getElementById("treino-who").value;
    const group = document.getElementById("treino-group").value.trim();
    if (!date) { alert("Escolha a data do treino."); return; }
    if (!draft.length) { alert("Adicione pelo menos um exercício."); return; }

    const exercises = draft.map(name => ({ name, done: false }));
    const btn = document.getElementById("treino-save");
    btn.disabled = true;
    try {
      await push(treinosRef, {
        date,
        who,
        group,
        exercises,
        title: buildCalendarTitle(who, exercises),
        createdAt: Date.now()
      });
      draft = [];
      form.reset();
      dateInput.value = todayISO();
      renderDraft();
    } catch (err) {
      console.error("Erro ao salvar treino:", err);
      alert("Não consegui salvar o treino. Tente de novo.");
    } finally {
      btn.disabled = false;
    }
  });

  // Marcar/desmarcar só muda a aparência; o salvamento acontece no botão "Salvar".
  list.addEventListener("change", e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const li = e.target.closest(".treino-ex");
    li.classList.toggle("is-done", e.target.checked);
    const card = e.target.closest(".treino-card");
    const all = card.querySelectorAll(".treino-ex");
    const done = card.querySelectorAll(".treino-ex.is-done").length;
    card.querySelector(".treino-progress").textContent = `${done}/${all.length} feitos`;
  });

  list.addEventListener("click", async e => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const card = actionEl.closest(".treino-card");
    const key = card.dataset.key;

    if (actionEl.dataset.action === "delete") {
      if (!confirm("Excluir este treino?")) return;
      await remove(ref(db, `treinos/${key}`));
      return;
    }

    if (actionEl.dataset.action === "save") {
      const original = items.find(x => x.key === key);
      if (!original) return;
      const exercises = [...card.querySelectorAll(".treino-ex")].map(li => ({
        name: li.dataset.name,
        done: li.querySelector("input").checked
      }));
      actionEl.disabled = true;
      try {
        await update(ref(db, `treinos/${key}`), {
          exercises,
          title: buildCalendarTitle(original.who, exercises)
        });
        actionEl.textContent = "Salvo ✓";
        setTimeout(() => { actionEl.textContent = "Salvar"; }, 1200);
      } catch (err) {
        console.error("Erro ao atualizar treino:", err);
        alert("Não consegui salvar. Tente de novo.");
      } finally {
        actionEl.disabled = false;
      }
    }
  });

  onValue(treinosRef, snap => {
    const val = snap.val() || {};
    items = Object.entries(val)
      .map(([key, v]) => ({ key, ...v, exercises: Object.values(v.exercises || {}) }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
    renderList();
  });
}
