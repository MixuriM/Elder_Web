// Marcador único da conta excluída (LGPD art. 18). A exclusão anonimiza a linha de Usuario, nunca a apaga (FKs NoAction e
// autoria obrigatória), e troca o e-mail por este. Quem recusa o ID Token de antes da exclusão (requireAuth e /auth/sync)
// reconhece a conta por aqui: monte e leia o marcador só por estas funções.
export const DOMINIO_CONTA_EXCLUIDA = "excluido.invalid"; // .invalid é TLD reservado: nenhum cadastro real termina assim

// Mesma resposta do token inválido: quem tem o token antigo não descobre que a conta existiu.
export const MSG_TOKEN_INVALIDO = "Token inválido ou expirado.";

export function emailContaExcluida(id: number): string {
  return `excluido-${id}@${DOMINIO_CONTA_EXCLUIDA}`;
}

// Aceita qualquer valor: o e-mail vem do banco e pode ser nulo.
export function ehContaExcluida(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${DOMINIO_CONTA_EXCLUIDA}`);
}
