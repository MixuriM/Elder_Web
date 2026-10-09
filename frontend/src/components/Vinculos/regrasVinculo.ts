import type { Vinculo } from "./CardVinculo";

export type TipoVinculo = "familiar" | "cuidador";
export type AcaoAdicionar = "solicitar" | "cadastrar" | "convidar";

// Só o que o backend deixa cada perfil fazer: cuidador pede vínculo de cuidador; familiar pede vínculo de
// familiar ou cadastra idoso; idoso convida um familiar (cuidador sempre pede, e o idoso aprova).
export function acoesDoPerfil(tipoPerfil: string | null, tipo: TipoVinculo): AcaoAdicionar[] {
  if (tipoPerfil === "cuidador" && tipo === "cuidador") return ["solicitar"];
  if (tipoPerfil === "familiar" && tipo === "familiar") return ["solicitar", "cadastrar"];
  if (tipoPerfil === "idoso" && tipo === "familiar") return ["convidar"];
  return [];
}

export type ModoDecisao = "idoso" | "familiar";

// Quem pode aprovar, recusar e contestar segue o modo de decisão do idoso dono do vínculo. O backend continua
// sendo a barreira real (403); aqui só se decide quando mostrar o botão.
// - dono (idoso logado): só com o modo "idoso".
// - titular (familiar com vínculo aprovado): o backend só devolve esses vínculos quando o modo já é "familiar".
// - vinculado (a própria pessoa que pediu): nunca decide o próprio vínculo.
export function temAutoridade(v: Vinculo, tipoPerfil: string | null, modo: ModoDecisao): boolean {
  if (v.papel_do_chamador === "dono") return tipoPerfil === "idoso" && modo === "idoso";
  if (v.papel_do_chamador === "titular") return tipoPerfil === "familiar";
  return false;
}

const ORIGENS_AUTOMATICAS = ["convite_idoso", "cadastro_familiar"];

// Contestar vale só para vínculo de familiar já aprovado sem decisão humana (convite do idoso ou cadastro feito
// pelo familiar). O backend não exige janela de notificação para isso.
export function podeContestar(v: Vinculo, tipoPerfil: string | null, modo: ModoDecisao): boolean {
  return (
    v.tipo_vinculo === "familiar" &&
    v.status === "aprovado" &&
    ORIGENS_AUTOMATICAS.includes(v.origem) &&
    temAutoridade(v, tipoPerfil, modo)
  );
}

// Vínculo de origem automática só se aprova pela confirmação do e-mail (o backend responde 409 ao aprovar à mão).
export function podeAprovarManual(v: Vinculo): boolean {
  return !ORIGENS_AUTOMATICAS.includes(v.origem);
}

// Aviso "e-mail ainda não confirmado": só nos vínculos de aprovação automática, ainda pendentes e sem confirmação.
export function emailNaoConfirmado(v: Vinculo): boolean {
  return ORIGENS_AUTOMATICAS.includes(v.origem) && v.status === "pendente" && v.confirmado_em === null;
}

export function formatarDataBR(data: string | null | undefined): string {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
