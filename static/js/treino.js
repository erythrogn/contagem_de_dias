// Aba de treino (Coisinhas): só a interface. O acesso ao banco fica em treino-storage.js.
import { escapeHTML } from "/static/js/utils.js";
import {
  criarPlano, adicionarExercicio, removerExercicio, excluirPlano,
  salvarRegistro, excluirRegistro, recordKey,
  assinarPlanos, assinarRegistros
} from "/static/js/treino-storage.js";

let planos = [];          // { key, name, exercises: [string] }
let registros = {};       // key -> registro
let planDraft = [];

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "Sem data";
}


// ─── Planos (treinos montados) ────────────────────────────────────────────────

function renderDraft() {
  $("plano-draft").innerHTML = planDraft.map((name, i) => `
    <li class="treino-draft-item">
      <span>${escapeHTML(name)}</span>
      <button type="button" class="treino-draft-remove" data-idx="${i}" aria-label="Remover ${escapeHTML(name)}">×</button>
    </li>`).join("");
}

function renderPlanos() {
  const list = $("plano-list");
  if (!planos.length) {
    list.innerHTML = `<p class="empty-text">Nenhum treino montado ainda.</p>`;
  } else {
    list.innerHTML = planos.map(p => `
      <article class="treino-card" data-key="${escapeHTML(p.key)}">
        <header class="treino-card-head">
          <h3 class="treino-plan-name">${escapeHTML(p.name)}</h3>
          <button type="button" class="treino-btn-del" data-action="del-plan">Excluir</button>
        </header>
        <ul class="treino-exercises">
          ${p.exercises.map((ex, i) => `
            <li class="treino-ex-row">
              <span>${escapeHTML(ex)}</span>
              <button type="button" class="treino-draft-remove" data-action="rm-ex" data-idx="${i}" aria-label="Remover ${escapeHTML(ex)}">×</button>
            </li>`).join("") || `<li class="empty-text">Sem exercícios ainda.</li>`}
        </ul>
        <div class="treino-add-row">
          <input type="text" class="field-input" data-role="new-ex" placeholder="Novo exercício">
          <button type="button" class="treino-btn-save" data-action="add-ex">Adicionar</button>
        </div>
      </article>`).join("");
  }
  renderPlanOptions();
}

function renderPlanOptions() {
  const sel = $("reg-plan");
  const current = sel.value;
  sel.innerHTML = planos.length
    ? planos.map(p => `<option value="${escapeHTML(p.key)}">${escapeHTML(p.name)}</option>`).join("")
    : `<option value="">Monte um treino primeiro</option>`;
  if (planos.some(p => p.key === current)) sel.value = current;
  renderChecklist();
}

function bindPlanos() {
  $("plano-ex-add").addEventListener("click", addPlanDraftExercise);
  $("plano-ex-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addPlanDraftExercise(); }
  });
  $("plano-draft").addEventListener("click", e => {
    const btn = e.target.closest(".treino-draft-remove");
    if (!btn) return;
    planDraft.splice(Number(btn.dataset.idx), 1);
    renderDraft();
  });

  $("plano-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("plano-name").value.trim();
    if (!name) { alert("Dê um nome ao treino."); return; }
    if (!planDraft.length) { alert("Adicione pelo menos um exercício."); return; }
    const btn = $("plano-save");
    btn.disabled = true;
    try {
      await criarPlano({ name, exercises: planDraft });
      planDraft = [];
      $("plano-form").reset();
      renderDraft();
    } catch (err) {
      console.error("Erro ao salvar treino:", err);
      alert("Não consegui salvar o treino.");
    } finally {
      btn.disabled = false;
    }
  });

  // Edições dentro do cartão salvam direto no banco.
  // Enter no campo de exercício de um cartão também adiciona.
  $("plano-list").addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target.matches('[data-role="new-ex"]')) return;
    e.preventDefault();
    e.target.closest(".treino-card").querySelector('[data-action="add-ex"]').click();
  });

  $("plano-list").addEventListener("click", async e => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const card = actionEl.closest(".treino-card");
    const plan = planos.find(p => p.key === card.dataset.key);
    if (!plan) return;
    const action = actionEl.dataset.action;

    try {
      if (action === "del-plan") {
        if (!confirm(`Excluir o treino "${plan.name}"? Os dias já registrados continuam.`)) return;
        await excluirPlano(plan);
      } else if (action === "add-ex") {
        const input = card.querySelector('[data-role="new-ex"]');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        input.value = "";
        try {
          await adicionarExercicio(plan, name);
        } catch (err) {
          input.value = name;
          throw err;
        }
        input.focus();
      } else if (action === "rm-ex") {
        const idx = Number(actionEl.dataset.idx);
        await removerExercicio(plan, idx);
      }
    } catch (err) {
      console.error("Erro ao atualizar treino:", err);
      alert("Não consegui atualizar o treino.");
    }
  });
}

function addPlanDraftExercise() {
  const input = $("plano-ex-input");
  const name = input.value.trim();
  if (!name) return;
  planDraft.push(name);
  input.value = "";
  input.focus();
  renderDraft();
}

// ─── Registro do dia (controlador) ────────────────────────────────────────────

function currentSelection() {
  return { date: $("reg-date").value, who: $("reg-who").value, planId: $("reg-plan").value };
}

function renderChecklist() {
  const { date, who, planId } = currentSelection();
  const plan = planos.find(p => p.key === planId);
  const rec = registros[recordKey(date, who)];
  const doneSet = new Set(rec && rec.planId === planId ? Object.values(rec.done || {}) : []);

  const list = $("reg-checklist");
  if (!plan) {
    list.innerHTML = `<li class="empty-text">Nenhum treino selecionado.</li>`;
  } else if (!plan.exercises.length) {
    list.innerHTML = `<li class="empty-text">Esse treino ainda não tem exercícios.</li>`;
  } else {
    list.innerHTML = plan.exercises.map(ex => `
      <li class="treino-ex${doneSet.has(ex) ? " is-done" : ""}" data-name="${escapeHTML(ex)}">
        <label>
          <input type="checkbox" ${doneSet.has(ex) ? "checked" : ""}>
          <span>${escapeHTML(ex)}</span>
        </label>
      </li>`).join("");
  }
  updateProgress();
  $("reg-clear").hidden = !rec;
}

function updateProgress() {
  const items = [...$("reg-checklist").querySelectorAll(".treino-ex")];
  const done = items.filter(li => li.classList.contains("is-done")).length;
  $("reg-progress").textContent = items.length ? `${done}/${items.length} feitos` : "";
}

function renderRegistros() {
  const list = $("reg-list");
  const itens = Object.entries(registros)
    .map(([key, r]) => ({ key, ...r }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.who || "").localeCompare(a.who || ""));

  if (!itens.length) {
    list.innerHTML = `<p class="empty-text">Nenhum dia marcado ainda.</p>`;
    return;
  }
  list.innerHTML = itens.map(r => {
    const done = Object.values(r.done || {});
    return `
      <article class="treino-card" data-key="${escapeHTML(r.key)}">
        <header class="treino-card-head">
          <div class="treino-meta">
            <span class="treino-date">${escapeHTML(formatDate(r.date))}</span>
            <span class="treino-who">${escapeHTML(r.who)}</span>
          </div>
          <button type="button" class="treino-btn-del" data-action="del-reg">Excluir</button>
        </header>
        <h3 class="treino-plan-name">${escapeHTML(r.planName || "")}</h3>
        <p class="treino-progress">${done.length}/${r.total || 0} feitos${done.length ? ": " + escapeHTML(done.join(", ")) : ""}</p>
        <footer class="treino-card-foot">
          <button type="button" class="treino-btn-save" data-action="open-reg">Abrir</button>
        </footer>
      </article>`;
  }).join("");
}

function bindRegistro() {
  $("reg-date").value = todayISO();
  ["reg-date", "reg-who", "reg-plan"].forEach(id => $(id).addEventListener("change", renderChecklist));

  $("reg-checklist").addEventListener("change", e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    e.target.closest(".treino-ex").classList.toggle("is-done", e.target.checked);
    updateProgress();
  });

  $("reg-form").addEventListener("submit", async e => {
    e.preventDefault();
    const { date, who, planId } = currentSelection();
    const plan = planos.find(p => p.key === planId);
    if (!date) { alert("Escolha a data."); return; }
    if (!plan) { alert("Escolha um treino."); return; }

    const done = [...$("reg-checklist").querySelectorAll(".treino-ex.is-done")].map(li => li.dataset.name);
    const btn = $("reg-save");
    btn.disabled = true;
    try {
      await salvarRegistro({ date, who, plan, done });
      btn.querySelector("span").textContent = "Salvo ✓";
      setTimeout(() => { btn.querySelector("span").textContent = "Salvar dia"; }, 1200);
    } catch (err) {
      console.error("Erro ao salvar registro:", err);
      alert("Não consegui salvar o dia.");
    } finally {
      btn.disabled = false;
    }
  });

  $("reg-clear").addEventListener("click", async () => {
    const { date, who } = currentSelection();
    if (!confirm("Apagar o registro deste dia?")) return;
    await excluirRegistro(date, who);
  });

  $("reg-list").addEventListener("click", async e => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const rec = registros[actionEl.closest(".treino-card").dataset.key];
    if (!rec) return;
    if (actionEl.dataset.action === "open-reg") {
      $("reg-date").value = rec.date;
      $("reg-who").value = rec.who;
      if (planos.some(p => p.key === rec.planId)) $("reg-plan").value = rec.planId;
      renderChecklist();
      $("reg-form").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (actionEl.dataset.action === "del-reg") {
      if (!confirm("Apagar este registro?")) return;
      await excluirRegistro(rec.date, rec.who);
    }
  });
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export function initTreinoModule() {
  if (!$("section-treino")) return;
  renderDraft();
  bindPlanos();
  bindRegistro();

  assinarPlanos(lista => {
    planos = lista;
    renderPlanos();
  });

  assinarRegistros(val => {
    registros = val;
    renderRegistros();
    renderChecklist();
  });
}
