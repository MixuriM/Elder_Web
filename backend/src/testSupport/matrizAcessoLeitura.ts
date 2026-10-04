// Matriz de acesso das rotas de LEITURA por vínculo (itens 4.4, 5.3 e 5.4), compartilhada por
// saudeHistorico.test.ts, remediosHistorico.test.ts e historicoPdf.test.ts. Só dados: cada suíte monta os próprios fakes.
// Toda nova rota de leitura por vínculo deve entrar nesta lista. Ids FICTÍCIOS, só para teste.
// Fora do build de produção (tsconfig exclui src/testSupport) e não coletada como suíte (sem .test).

export const IDOSO_A = 5;
export const IDOSO_B = 6;
export const CUIDADOR = 10;
export const FAMILIAR = 20;

export type AtorLeitura = "idoso" | "cuidador" | "familiar";

export type VinculoCaso = {
  tipo_vinculo: "cuidador" | "familiar";
  status: "pendente" | "aprovado" | "recusado";
  idoso: "A" | "B";
  // Valor das 3 flags permite_* (só cuidador). Ausente: false.
  flags?: boolean;
  // Só familiar. Leitura não pode depender disso.
  modo_decisao?: "idoso" | "familiar";
};

export type CasoAcessoLeitura = {
  nome: string;
  ator: AtorLeitura;
  // proprio: GET /<recurso>; vinculo: GET /<recurso>/idoso/:idosoId com o id do idoso A.
  rota: "proprio" | "vinculo";
  vinculo: VinculoCaso | null;
  esperado: 200 | 403;
};

export const CASOS_ACESSO_LEITURA: CasoAcessoLeitura[] = [
  { nome: "idoso lê o próprio", ator: "idoso", rota: "proprio", vinculo: null, esperado: 200 },
  { nome: "cuidador na rota própria", ator: "cuidador", rota: "proprio", vinculo: null, esperado: 403 },
  { nome: "familiar na rota própria", ator: "familiar", rota: "proprio", vinculo: null, esperado: 403 },
  {
    nome: "familiar aprovado do idoso A, modo_decisao 'idoso'",
    ator: "familiar",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "familiar", status: "aprovado", idoso: "A", modo_decisao: "idoso" },
    esperado: 200,
  },
  {
    nome: "familiar aprovado do idoso A, modo_decisao 'familiar'",
    ator: "familiar",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "familiar", status: "aprovado", idoso: "A", modo_decisao: "familiar" },
    esperado: 200,
  },
  {
    nome: "cuidador aprovado do idoso A, 3 flags false",
    ator: "cuidador",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "cuidador", status: "aprovado", idoso: "A", flags: false },
    esperado: 200,
  },
  {
    nome: "cuidador aprovado do idoso A, 3 flags true",
    ator: "cuidador",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "cuidador", status: "aprovado", idoso: "A", flags: true },
    esperado: 200,
  },
  { nome: "cuidador sem vínculo", ator: "cuidador", rota: "vinculo", vinculo: null, esperado: 403 },
  { nome: "familiar sem vínculo", ator: "familiar", rota: "vinculo", vinculo: null, esperado: 403 },
  {
    nome: "cuidador pendente",
    ator: "cuidador",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "cuidador", status: "pendente", idoso: "A", flags: true },
    esperado: 403,
  },
  {
    nome: "familiar pendente",
    ator: "familiar",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "familiar", status: "pendente", idoso: "A", modo_decisao: "familiar" },
    esperado: 403,
  },
  {
    nome: "cuidador recusado",
    ator: "cuidador",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "cuidador", status: "recusado", idoso: "A", flags: true },
    esperado: 403,
  },
  {
    nome: "familiar recusado",
    ator: "familiar",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "familiar", status: "recusado", idoso: "A", modo_decisao: "familiar" },
    esperado: 403,
  },
  {
    nome: "familiar aprovado só do idoso B pedindo o idoso A",
    ator: "familiar",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "familiar", status: "aprovado", idoso: "B", modo_decisao: "familiar" },
    esperado: 403,
  },
  {
    nome: "cuidador aprovado só do idoso B pedindo o idoso A",
    ator: "cuidador",
    rota: "vinculo",
    vinculo: { tipo_vinculo: "cuidador", status: "aprovado", idoso: "B", flags: true },
    esperado: 403,
  },
  { nome: "idoso A na rota de vínculo com o próprio id", ator: "idoso", rota: "vinculo", vinculo: null, esperado: 403 },
];
