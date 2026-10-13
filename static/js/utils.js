// Utilitários compartilhados entre páginas.

/**
 * Escapa texto para uso seguro dentro de HTML (conteúdo e atributos).
 * Use sempre que inserir dados vindos do Firebase em innerHTML/template strings.
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
