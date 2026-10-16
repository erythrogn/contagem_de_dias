// Persistência da aba de treino (Firebase Realtime Database).
// Toda leitura e escrita de treinos passa por aqui; a tela (treino.js) só chama estas funções.
//
// Estrutura no banco:
//   treinoPlanos/{key}           -> { name, exercises: [string], createdAt }
//   treinoRegistros/{data}_{quem} -> { date, who, planId, planName, done: [string], total, title, updatedAt }
import { db, ref, push, onValue, update, remove } from "/static/js/app.js";

export const PLANOS = "treinoPlanos";
export const REGISTROS = "treinoRegistros";

// Chave do registro: um por pessoa por dia.
export function recordKey(date, who) {
  return `${date}_${who}`;
}

// Título usado pelo calendário: "Tiago · Treino A (2/5): Supino, Remada"
export function buildRecordTitle(who, planName, done, total) {
  const doneTxt = done.length ? done.join(", ") : "nada marcado";
  return `${who} · ${planName} (${done.length}/${total}): ${doneTxt}`;
}

// ─── Leitura em tempo real ────────────────────────────────────────────────────

export function assinarPlanos(callback) {
  return onValue(ref(db, PLANOS), snap => {
    const val = snap.val() || {};
    const planos = Object.entries(val)
      .map(([key, v]) => ({ key, name: v.name || "Sem nome", exercises: Object.values(v.exercises || {}) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    callback(planos);
  });
}

export function assinarRegistros(callback) {
  return onValue(ref(db, REGISTROS), snap => {
    callback(snap.val() || {});
  });
}

// ─── Planos (treinos montados) ────────────────────────────────────────────────

export function criarPlano({ name, exercises }) {
  return push(ref(db, PLANOS), { name, exercises, createdAt: Date.now() });
}

export function adicionarExercicio(plan, nome) {
  return update(ref(db, `${PLANOS}/${plan.key}`), { exercises: [...plan.exercises, nome] });
}

export function removerExercicio(plan, idx) {
  return update(ref(db, `${PLANOS}/${plan.key}`), {
    exercises: plan.exercises.filter((_, i) => i !== idx)
  });
}

export function excluirPlano(plan) {
  return remove(ref(db, `${PLANOS}/${plan.key}`));
}

// ─── Registros do dia ─────────────────────────────────────────────────────────

export function salvarRegistro({ date, who, plan, done }) {
  const total = plan.exercises.length;
  return update(ref(db, `${REGISTROS}/${recordKey(date, who)}`), {
    date,
    who,
    planId: plan.key,
    planName: plan.name,
    done,
    total,
    title: buildRecordTitle(who, plan.name, done, total),
    updatedAt: Date.now()
  });
}

export function excluirRegistro(date, who) {
  return remove(ref(db, `${REGISTROS}/${recordKey(date, who)}`));
}
