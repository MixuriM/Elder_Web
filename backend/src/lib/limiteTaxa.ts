import type { Request, RequestHandler, Response } from "express";

// Limite de taxa sem dependência (decisão D1 de 2026-10-14). Janela fixa por chave, em memória do processo: um
// restart do Render zera as contagens e duas instâncias não dividem estado (o plano free roda uma só).
// ponytail: Map em memória, trocar por store compartilhado se o backend passar a rodar em mais de uma instância.
export const MSG_LIMITE_TAXA = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

const PURGA_ACIMA_DE = 5000;

type Opcoes = { janelaMs: number; maximo: number; chave: (req: Request, res: Response) => string | undefined };
type Entrada = { inicio: number; contagem: number };

const mapas = new Set<Map<string, Entrada>>();
let ligadoEmTeste: boolean | undefined;

// Só para testes: liga (true) ou volta ao padrão do ambiente (undefined).
export function definirLimitesEmTeste(ligado: boolean | undefined) {
  ligadoEmTeste = ligado;
}

export function limparLimitadores() {
  for (const mapa of mapas) mapa.clear();
}

// Lido a cada requisição. Produção sempre limita; sob Jest vem desligado para não quebrar as suítes grandes; no
// desenvolvimento local LIMITE_TAXA_DESLIGADO=1 desliga.
function ativo(): boolean {
  if (ligadoEmTeste !== undefined) return ligadoEmTeste;
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.NODE_ENV === "test") return false;
  return process.env.LIMITE_TAXA_DESLIGADO !== "1";
}

// Chave das rotas autenticadas: o usuário resolvido pelo requireAuth.
export const porUsuario = (req: Request) => (req.usuarioId === undefined ? undefined : String(req.usuarioId));

export const QUINZE_MIN = 15 * 60 * 1000;

// Nunca loga a chave, o IP nem o corpo. Sem chave (não deveria acontecer depois do requireAuth), deixa passar.
export function criarLimitador({ janelaMs, maximo, chave }: Opcoes): RequestHandler & { tamanho: () => number } {
  const mapa = new Map<string, Entrada>();
  mapas.add(mapa);

  const limitador: RequestHandler = (req, res, next) => {
    if (!ativo()) return next();
    const k = chave(req, res);
    if (k === undefined) return next();

    const agora = Date.now();
    let entrada = mapa.get(k);
    if (!entrada || agora - entrada.inicio >= janelaMs) {
      if (!entrada && mapa.size > PURGA_ACIMA_DE) {
        for (const [outra, e] of mapa) if (agora - e.inicio >= janelaMs) mapa.delete(outra);
      }
      entrada = { inicio: agora, contagem: 0 };
      mapa.set(k, entrada);
    }
    entrada.contagem++;
    if (entrada.contagem > maximo) {
      res.setHeader("Retry-After", String(Math.ceil((entrada.inicio + janelaMs - agora) / 1000)));
      return res.status(429).json({ error: MSG_LIMITE_TAXA });
    }
    next();
  };
  return Object.assign(limitador, { tamanho: () => mapa.size });
}
