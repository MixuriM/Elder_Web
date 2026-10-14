// Aplica as preferências salvas antes do React montar (sem piscar). Mesmas chaves e classes de
// src/lib/preferencias.ts. Arquivo externo, carregado síncrono no head do index.html: script inline exigiria
// 'unsafe-inline' em script-src na CSP (decisão D6 de 2026-10-14). Sem storage, vale o padrão (e menos movimento se
// o aparelho pedir).
(function () {
  var classes = document.documentElement.classList;
  var ler = function (chave) {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  };
  var midia = function (consulta) {
    return !!window.matchMedia && window.matchMedia(consulta).matches;
  };
  var tema = ler("tema");
  var tamanho = ler("tamanhoTexto");
  var movimento = ler("reduzirMovimento");
  if (tema === "escuro" || (tema === "sistema" && midia("(prefers-color-scheme: dark)"))) classes.add("dark");
  if (tamanho === "grande") classes.add("texto-grande");
  if (tamanho === "muito-grande") classes.add("texto-muito-grande");
  if (movimento === null ? midia("(prefers-reduced-motion: reduce)") : movimento === "sim") {
    classes.add("reduzir-movimento");
  }
})();
