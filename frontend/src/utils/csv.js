// Spreadsheet export: a CSV file that Excel and Google Sheets open directly

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  // quote anything with commas, quotes or line breaks; stop Excel from treating =, +, -, @ as formulas
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");

export const downloadCsv = (filename, headers, rows) => {
  // ﻿ tells Excel the file is UTF-8, so names with accents or Arabic show correctly
  const blob = new Blob(["﻿" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
