import type { BrowserContext } from "@playwright/test";

// O aviso de cookies fica fixo no pé de toda página até alguém tocar em "Entendi". Nos testes que não são sobre ele, o contexto já
// chega com o aviso visto (mesma chave de lib/preferencias.ts), para ele não cobrir o que se mede nem bloquear cliques.
export async function marcarAvisoCookiesVisto(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("avisoCookies", "sim");
    } catch {
      // sem localStorage: o aviso aparece e o teste segue
    }
  });
  return context;
}
