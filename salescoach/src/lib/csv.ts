/** Minimal CSV writer for back-office exports. */

export type CsvValue = string | number | boolean | Date | null | undefined;

function cell(value: CsvValue): string {
  if (value == null) return "";
  let text =
    value instanceof Date ? value.toISOString() : typeof value === "string" ? value : String(value);
  // Neutralize spreadsheet formula injection (leading = + - @).
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
