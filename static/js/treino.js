// Aba de Treino (Coisinhas): interface. Todo acesso ao banco fica em treino-storage.js.
// Estrutura igual à de filmes.js: estado central, renderização e delegação de eventos.
import { escapeHTML } from "/static/js/utils.js";
import {
  criarPlano, adicionarExercicio, removerExercicio, excluirPlano,
  salvarRegistro, excluirRegistro, recordKey,
  assinarPlanos, assinarRegistros
} from "/static/js/treino-storage.js";

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

const state = {
  planos: [],      // { key, name, exercises: [string] }
  registros: {},   // recordKey -> { date, who, planId, planName, done, total }
  draft: [],       // exercícios do treino em montagem
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "Sem data";
}

function alertErro(msg, err) {
  console.error(msg, err);
  alert(msg);
}

// ─── Montar treino ────────────────────────────────────────────────────────────

function renderDraft() {
  $("plano-draft").innerHTML = state.draft.map((nome, i) => `
    <li class="treino-chip">
      <span>${escapeHTML(nome)}</span>
      <button type="button" class="treino-icon-btn" data-action="draft-rm" data-idx="${i}" aria-label="Remover ${escapeHTML(nome)}">×</button>
    </li>`).join("");
}

function planoCardHTML(p) {
  const exercicios = p.exercises.length
    ? p.exercises.map((ex, i) => `
        <li class="treino-ex-row">
          <span>${escapeHTML(ex)}</span>
          <button type="button" class="treino-icon-btn" data-action="rm-ex" data-idx="${i}" aria-label="Remover ${escapeHTML(ex)}">×</button>
        </li>`).join("")
    : `<li class="treino-empty">Sem exercícios ainda.</li>`;

  return `
    <article class="treino-card" data-key="${escapeHTML(p.key)}">
      <header class="treino-card-head">
        <h3 class="treino-card-name">${escapeHTML(p.name)}</h3>
        <button type="button" class="treino-btn-text danger" data-action="del-plan">Excluir</button>
      </header>
      <ul class="treino-ex-list">${exercicios}</ul>
      <div class="treino-add-row">
        <input type="text" class="field-input treino-mini-input" data-role="new-ex" placeholder="novo exercício" autocomplete="off" aria-label="Novo exercício para ${escapeHTML(p.name)}">
        <button type="button" class="btn-submit btn-mini" data-action="add-ex">Adicionar</button>
      </div>
    </article>`;
}

function renderPlanos() {
  const list = $("plano-list");
  list.innerHTML = state.planos.length
    ? state.planos.map(planoCardHTML).join("")
    : `<div class="empty-state"><p class="empty-text">Nenhum treino montado ainda.</p></div>`;
  renderPlanOptions();
}

function renderPlanOptions() {
  const sel = $("reg-plan");
  const atual = sel.value;
  sel.innerHTML = state.planos.length
    ? state.planos.map(p => `<option value="${escapeHTML(p.key)}">${escapeHTML(p.name)}</option>`).join("")
    : `<option value="">Monte um treino primeiro</option>`;
  if (state.planos.some(p => p.key === atual)) sel.value = atual;
  renderChecklist();
}

function addDraftExercise() {
  const input = $("plano-ex-input");
  const nome = input.value.trim();
  if (!nome) { input.focus(); return; }
  state.draft.push(nome);
  input.value = "";
  input.focus();
  renderDraft();
}

async function addExercicioAoPlano(card) {
  const plan = state.planos.find(p => p.key === card.dataset.key);
  const input = card.querySelector('[data-role="new-ex"]');
  const nome = input.value.trim();
  if (!plan || !nome) { input.focus(); return; }
  input.value = "";
  try {
    await adicionarExercicio(plan, nome);
    input.focus();
  } catch (err) {
    input.value = nome;
    alertErro("Não consegui adicionar o exercício.", err);
  }
}

async function handlePlanoClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const card = btn.closest(".treino-card");
  const plan = state.planos.find(p => p.key === card.dataset.key);
  if (!plan) return;

  try {
    switch (btn.dataset.action) {
      case "del-plan":
        if (!confirm(`Excluir o treino "${plan.name}"? Os dias já registrados continuam.`)) return;
        await excluirPlano(plan);
        break;
      case "add-ex":
        await addExercicioAoPlano(card);
        break;
      case "rm-ex":
        await removerExercicio(plan, Number(btn.dataset.idx));
        break;
    }
  } catch (err) {
    alertErro("Não consegui atualizar o treino.", err);
  }
}

function bindPlanos() {
  $("plano-ex-add").addEventListener("click", addDraftExercise);
  $("plano-ex-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addDraftExercise(); }
  });

  $("plano-draft").addEventListener("click", e => {
    const btn = e.target.closest('[data-action="draft-rm"]');
    if (!btn) return;
    state.draft.splice(Number(btn.dataset.idx), 1);
    renderDraft();
  });

  $("plano-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("plano-name").value.trim();
    if (!name) { $("plano-name").focus(); alert("Dê um nome ao treino."); return; }
    if (!state.draft.length) { alert("Adicione pelo menos um exercício."); return; }

    const btn = $("plano-save");
    btn.disabled = true;
    try {
      await criarPlano({ name, exercises: state.draft });
      state.draft = [];
      $("plano-form").reset();
      renderDraft();
    } catch (err) {
      alertErro("Não consegui salvar o treino.", err);
    } finally {
      btn.disabled = false;
    }
  });

  $("plano-list").addEventListener("click", handlePlanoClick);
  $("plano-list").addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target.matches('[data-role="new-ex"]')) return;
    e.preventDefault();
    addExercicioAoPlano(e.target.closest(".treino-card"));
  });
}

// ─── Marcar o dia ─────────────────────────────────────────────────────────────

function selecao() {
  return { date: $("reg-date").value, who: $("reg-who").value, planId: $("reg-plan").value };
}

function renderChecklist() {
  const { date, who, planId } = selecao();
  const plan = state.planos.find(p => p.key === planId);
  const rec = state.registros[recordKey(date, who)];
  const feitos = new Set(rec && rec.planId === planId ? Object.values(rec.done || {}) : []);

  const list = $("reg-checklist");
  if (!plan) {
    list.innerHTML = `<li class="treino-empty">Monte um treino para marcar o dia.</li>`;
  } else if (!plan.exercises.length) {
    list.innerHTML = `<li class="treino-empty">Esse treino ainda não tem exercícios.</li>`;
  } else {
    list.innerHTML = plan.exercises.map(ex => `
      <li class="treino-check${feitos.has(ex) ? " is-done" : ""}">
        <label>
          <input type="checkbox" data-name="${escapeHTML(ex)}"${feitos.has(ex) ? " checked" : ""}>
          <span>${escapeHTML(ex)}</span>
        </label>
      </li>`).join("");
  }

  $("reg-clear").hidden = !rec;
  updateProgress();
}

function updateProgress() {
  const boxes = [...$("reg-checklist").querySelectorAll('input[type="checkbox"]')];
  const feitos = boxes.filter(b => b.checked).length;
  $("reg-progress").textContent = boxes.length ? `${feitos} de ${boxes.length} feitos` : "";
}

function renderRegistros() {
  const list = $("reg-list");
  const itens = Object.entries(state.registros)
    .map(([key, r]) => ({ key, ...r }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.who || "").localeCompare(a.who || ""));

  if (!itens.length) {
    list.innerHTML = `<div class="empty-state"><p class="empty-text">Nenhum dia marcado ainda.</p></div>`;
    return;
  }

  list.innerHTML = itens.map(r => {
    const feitos = Object.values(r.done || {});
    return `
      <article class="treino-card treino-day" data-key="${escapeHTML(r.key)}">
        <header class="treino-card-head">
          <div class="treino-meta">
            <span class="treino-date">${escapeHTML(formatDate(r.date))}</span>
            <span class="treino-who">${escapeHTML(r.who || "")}</span>
          </div>
          <button type="button" class="treino-btn-text danger" data-action="del-reg">Excluir</button>
        </header>
        <h3 class="treino-card-name">${escapeHTML(r.planName || "Sem treino")}</h3>
        <p class="treino-progress">${feitos.length} de ${r.total || 0} feitos</p>
        ${feitos.length ? `<p class="treino-done-list">${feitos.map(f => escapeHTML(f)).join(" · ")}</p>` : ""}
        <footer class="treino-card-foot">
          <button type="button" class="btn-submit btn-mini" data-action="open-reg">Abrir dia</button>
        </footer>
      </article>`;
  }).join("");
}

function bindRegistro() {
  $("reg-date").value = todayISO();
  ["reg-date", "reg-who", "reg-plan"].forEach(id => $(id).addEventListener("change", renderChecklist));

  $("reg-checklist").addEventListener("change", e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    e.target.closest(".treino-check").classList.toggle("is-done", e.target.checked);
    updateProgress();
  });

  $("reg-form").addEventListener("submit", async e => {
    e.preventDefault();
    const { date, who, planId } = selecao();
    const plan = state.planos.find(p => p.key === planId);
    if (!date) { alert("Escolha a data."); return; }
    if (!plan) { alert("Escolha um treino."); return; }

    const done = [...$("reg-checklist").querySelectorAll('input[type="checkbox"]:checked')]
      .map(b => b.dataset.name);

    const btn = $("reg-save");
    btn.disabled = true;
    try {
      await salvarRegistro({ date, who, plan, done });
      btn.textContent = "Salvo ✓";
      setTimeout(() => { btn.textContent = "Salvar dia"; }, 1200);
    } catch (err) {
      alertErro("Não consegui salvar o dia.", err);
    } finally {
      btn.disabled = false;
    }
  });

  $("reg-clear").addEventListener("click", async () => {
    const { date, who } = selecao();
    if (!confirm("Apagar o registro deste dia?")) return;
    try {
      await excluirRegistro(date, who);
    } catch (err) {
      alertErro("Não consegui apagar o registro.", err);
    }
  });

  $("reg-list").addEventListener("click", async e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const rec = state.registros[btn.closest(".treino-card").dataset.key];
    if (!rec) return;

    if (btn.dataset.action === "open-reg") {
      $("reg-date").value = rec.date;
      $("reg-who").value = rec.who;
      if (state.planos.some(p => p.key === rec.planId)) $("reg-plan").value = rec.planId;
      renderChecklist();
      $("reg-form").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (btn.dataset.action === "del-reg") {
      if (!confirm("Apagar este registro?")) return;
      try {
        await excluirRegistro(rec.date, rec.who);
      } catch (err) {
        alertErro("Não consegui apagar o registro.", err);
      }
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
    state.planos = lista;
    renderPlanos();
  });

  assinarRegistros(val => {
    state.registros = val;
    renderRegistros();
    renderChecklist();
  });
}
