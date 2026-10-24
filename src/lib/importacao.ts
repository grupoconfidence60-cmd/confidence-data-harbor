import * as XLSX from "xlsx";

export const IMPORT_HEADERS = ["Matrícula", "Nome", "CPF", "Telefone", "E-mail", "Função", "Posto", "Admissão", "Vínculo", "Escala"];

export type ImportRow = { linha: number; matricula: string; nome: string; cpf: string | null; telefone: string | null; email: string | null; funcao_id: string | null; posto_id: string | null; data_admissao: string | null; vinculo: string | null; jornada: string | null; erros: string[] };
type Ref = { id: string; nome: string };
const norm = (s: unknown) => String(s ?? "").trim();
const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

function toDate(v: unknown): string | null | "invalid" {
  if (v === "" || v == null) return null;
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "invalid"; }
  const s = norm(v); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^\d{4}-\d{2}-\d{2}$/); return m ? s : "invalid";
}

/** Converts sheet rows (first row = headers) into validated employee rows. */
export function parseImport(sheet: unknown[][], refs: { funcoes: Ref[]; postos: Ref[]; existentes: string[]; escalas: { value: string; label: string }[] }): ImportRow[] {
  const [head = [], ...body] = sheet;
  const idx = (name: string) => head.findIndex((h) => key(norm(h)) === key(name));
  const col: Record<string, number> = Object.fromEntries(IMPORT_HEADERS.map((h) => [h, idx(h)]));
  const get = (r: unknown[], h: string) => ((col[h] ?? -1) >= 0 ? r[col[h]!] : "");
  const find = (list: Ref[], v: string) => list.find((x) => key(x.nome) === key(v))?.id ?? null;
  const seen = new Set(refs.existentes.map(key));
  const out: ImportRow[] = [];
  body.forEach((r, i) => {
    if (!r.some((c) => norm(c))) return;
    const erros: string[] = [];
    const matricula = norm(get(r, "Matrícula")); const nome = norm(get(r, "Nome"));
    if (!matricula) erros.push("Matrícula vazia"); else if (seen.has(key(matricula))) erros.push("Matrícula já cadastrada ou repetida");
    seen.add(key(matricula));
    if (!nome) erros.push("Nome vazio");
    const f = norm(get(r, "Função")), p = norm(get(r, "Posto")), e = norm(get(r, "Escala"));
    const funcao_id = f ? find(refs.funcoes, f) : null; if (f && !funcao_id) erros.push(`Função "${f}" não encontrada`);
    const posto_id = p ? find(refs.postos, p) : null; if (p && !posto_id) erros.push(`Posto "${p}" não encontrado`);
    const esc = e ? refs.escalas.find((x) => key(x.label) === key(e) || key(x.value) === key(e))?.value ?? null : null; if (e && !esc) erros.push(`Escala "${e}" não reconhecida`);
    const d = toDate(get(r, "Admissão")); if (d === "invalid") erros.push("Admissão inválida (use dd/mm/aaaa)");
    const opt = (h: string) => norm(get(r, h)) || null;
    out.push({ linha: i + 2, matricula, nome, cpf: opt("CPF"), telefone: opt("Telefone"), email: opt("E-mail"), funcao_id, posto_id, data_admissao: d === "invalid" ? null : d, vinculo: opt("Vínculo"), jornada: esc, erros });
  });
  return out;
}

export function baixarModeloImportacao() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([IMPORT_HEADERS]), "Colaboradores");
  XLSX.writeFile(book, "Confidence-Modelo-Importacao.xlsx");
}
