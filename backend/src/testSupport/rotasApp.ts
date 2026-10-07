// Enumera todas as rotas de um app Express 4 percorrendo app._router.stack (item 9.4). Usada por
// autorizacaoRotas.test.ts para provar que nenhuma rota nova entra sem classificação de autorização.
// Fora do build de produção e não coletada como suíte (sem .test). O prefixo de montagem é derivado do
// layer.regexp de cada router; se o formato mudar (outra versão do Express), a função lança em vez de errar.

type Layer = {
  name: string;
  regexp?: RegExp;
  route?: { path: unknown; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: { stack?: Layer[] };
};

export type RotaApp = {
  metodo: string; // GET, POST, PATCH, DELETE
  caminho: string; // prefixo de montagem + path da rota, ex.: /saude/idoso/:idosoId
  // Handlers na ordem em que o Express os executa.
  handlers: unknown[];
};

// Mount de app.use('/prefixo', router): ^\/prefixo\/?(?=\/|$)
const RE_MONTAGEM = /^\^\\\/(.+?)\\\/\?\(\?=\\\/\|\$\)$/;

function prefixoDe(layer: Layer): string {
  const m = layer.regexp ? RE_MONTAGEM.exec(layer.regexp.source) : null;
  if (!m) throw new Error(`rotasApp: formato de montagem não reconhecido: ${layer.regexp?.source}`);
  return "/" + m[1].replace(/\\(.)/g, "$1");
}

export function enumerarRotas(app: unknown): RotaApp[] {
  const pilha = (app as { _router?: { stack: Layer[] } })._router?.stack;
  if (!pilha) throw new Error("rotasApp: app._router.stack indisponível");

  const rotas: RotaApp[] = [];
  const coletar = (layer: Layer, prefixo: string) => {
    const rota = layer.route;
    if (!rota) return;
    if (typeof rota.path !== "string") throw new Error("rotasApp: path de rota não string");
    for (const metodo of Object.keys(rota.methods)) {
      if (!rota.methods[metodo]) continue;
      rotas.push({
        metodo: metodo.toUpperCase(),
        caminho: prefixo + (rota.path === "/" ? "" : rota.path) || "/",
        handlers: rota.stack.map((l) => l.handle),
      });
    }
  };

  for (const layer of pilha) {
    if (layer.route) coletar(layer, "");
    else if (layer.name === "router") {
      const prefixo = prefixoDe(layer);
      for (const filha of layer.handle.stack ?? []) {
        if (filha.name === "router") throw new Error("rotasApp: router aninhado não suportado");
        coletar(filha, prefixo);
      }
    }
  }
  return rotas;
}
