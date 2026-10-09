// O erro de chamarApi traz o status HTTP. Os textos das telas de vínculo são fixos por status: nunca
// repetem o corpo da resposta (ele pode citar dado do vínculo) e o 403 nunca explica a regra de autoridade.
export const ERRO_PADRAO = "Não foi possível concluir agora. Tente de novo em instantes.";

export function statusDoErro(erro: unknown): number | undefined {
  const status = (erro as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function mensagemPorStatus(
  erro: unknown,
  porStatus: Partial<Record<number, string>>,
  padrao: string = ERRO_PADRAO,
): string {
  const status = statusDoErro(erro);
  return (status !== undefined && porStatus[status]) || padrao;
}
