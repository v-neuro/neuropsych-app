export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Quoting alone does not prevent spreadsheet formulas. Keep actual numbers numeric.
  if (typeof value !== "number" && (/^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text))) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
