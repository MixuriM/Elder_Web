// Medição local do bundle de produção (tarefa de desempenho, 2026-10-13). Fora do CI, sem dependência:
// só Node (zlib) e a API do Vite já instalada.
//
// 1. Tamanho bruto, gzip e brotli de cada arquivo de dist/assets (rode `npm run build` antes).
// 2. Bundle inicial: o que dist/index.html carrega (script de entrada, modulepreload e CSS).
// 3. Quem pré-carrega cada chunk: os arrays de __vite__mapDeps de cada chunk (o que vira modulepreload
//    quando a importação dinâmica dispara).
// 4. Peso por pacote no chunk de entrada: um build em memória (write: false) devolve o renderedLength de
//    cada módulo, depois do tree-shaking e antes da minificação. Nada é gravado em disco.
//
// Uso (dentro de frontend/): node scripts/medir-bundle.mjs [--saida=arquivo.json]

import process from "node:process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { build } from "vite";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const assets = join(raiz, "dist", "assets");
const saida = process.argv.find((a) => a.startsWith("--saida="))?.split("=")[1];
const kb = (n) => Math.round(n / 102.4) / 10;

const arquivos = readdirSync(assets).map((nome) => {
  const buf = readFileSync(join(assets, nome));
  return { nome, bruto: buf.length, gzip: gzipSync(buf).length, brotli: brotliCompressSync(buf).length, texto: /\.(js|css)$/.test(nome) ? buf.toString("utf8") : "" };
});

const html = readFileSync(join(raiz, "dist", "index.html"), "utf8");
const iniciais = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);

// __vite__mapDeps: lista de dependências pré-carregadas por importação dinâmica.
const preCarregadoPor = {};
for (const a of arquivos) {
  const m = /__vite__mapDeps=\([^)]*?\[([^\]]*)\]/.exec(a.texto) ?? /const __vite__mapDeps.*?\[([^\]]*)\]/.exec(a.texto);
  if (!m) continue;
  for (const dep of m[1].split(",").map((s) => s.trim().replace(/^["'](?:assets\/)?|["']$/g, ""))) {
    (preCarregadoPor[dep] ??= []).push(a.nome);
  }
}

console.log("Arquivo".padEnd(46) + "bruto kB".padStart(10) + "gzip kB".padStart(10) + "br kB".padStart(10) + "  inicial");
for (const a of [...arquivos].sort((x, y) => y.bruto - x.bruto)) {
  console.log(a.nome.padEnd(46) + String(kb(a.bruto)).padStart(10) + String(kb(a.gzip)).padStart(10) + String(kb(a.brotli)).padStart(10) + (iniciais.includes(a.nome) ? "  sim" : ""));
}
const soma = (lista, campo) => lista.reduce((s, a) => s + a[campo], 0);
const ini = arquivos.filter((a) => iniciais.includes(a.nome));
const jsIni = ini.filter((a) => a.nome.endsWith(".js"));
console.log(`\nInicial (index.html): ${ini.length} arquivo(s), JS ${kb(soma(jsIni, "bruto"))} kB bruto / ${kb(soma(jsIni, "gzip"))} kB gzip; total ${kb(soma(ini, "bruto"))} kB bruto / ${kb(soma(ini, "gzip"))} kB gzip`);
const maior = [...arquivos].sort((x, y) => y.bruto - x.bruto)[0];
console.log(`Maior arquivo: ${maior.nome} (${kb(maior.bruto)} kB bruto / ${kb(maior.gzip)} kB gzip); pré-carregado por: ${(preCarregadoPor[maior.nome] ?? []).join(", ") || "ninguém (só import dinâmico sem preload)"}`);

// Peso por pacote nos chunks iniciais, a partir de um build em memória.
const out = await build({ root: raiz, logLevel: "silent", build: { write: false } });
const saidas = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
const pacotes = {};
for (const c of saidas) {
  if (c.type !== "chunk" || !iniciais.some((i) => c.fileName.endsWith(i))) continue;
  for (const [id, info] of Object.entries(c.modules)) {
    const pkg = /node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/.exec(id)?.[1]?.replace("\\", "/") ?? "(código do app)";
    pacotes[pkg] = (pacotes[pkg] ?? 0) + info.renderedLength;
  }
}
const totalPkg = Object.values(pacotes).reduce((s, n) => s + n, 0);
console.log("\nChunk inicial por pacote (renderedLength, antes da minificação):");
for (const [pkg, n] of Object.entries(pacotes).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${pkg.padEnd(36)} ${String(kb(n)).padStart(8)} kB  ${Math.round((n / totalPkg) * 100)}%`);
}

if (saida) {
  writeFileSync(saida, JSON.stringify({ arquivos: arquivos.map((a) => ({ nome: a.nome, bruto: a.bruto, gzip: a.gzip, brotli: a.brotli })), iniciais, preCarregadoPor, pacotes }, null, 2));
}
