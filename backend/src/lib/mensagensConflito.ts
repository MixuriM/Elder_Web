// Item 3.2 (RNF-011) — corpo dos 409 de conflito de e-mail no cadastro.
// PROVISÓRIO até a tarefa 3.3: os textos de proximo_passo não podem prometer fluxo
// (idoso assumir conta cadastrada por familiar) que ainda não existe.
// Nunca inclua aqui nome, e-mail, id ou tipo de outra conta.
export const CONFLITO_EMAIL = {
  EMAIL_JA_EM_USO_CADASTRO_IDOSO: {
    codigo: "EMAIL_JA_EM_USO_CADASTRO_IDOSO",
    error: "Já existe uma conta com este e-mail.",
    proximo_passo:
      "Se essa pessoa é o idoso que você quer acompanhar, use 'Solicitar vínculo' informando este e-mail. Se não, confira se o e-mail foi digitado corretamente.",
  },
  EMAIL_CADASTRADO_POR_FAMILIAR: {
    codigo: "EMAIL_CADASTRADO_POR_FAMILIAR",
    error: "Este e-mail já foi cadastrado por um familiar.",
    proximo_passo:
      "O acesso a contas cadastradas por familiar ainda não está disponível. Enquanto isso, use outro e-mail para se cadastrar.",
  },
  EMAIL_JA_EM_USO: {
    codigo: "EMAIL_JA_EM_USO",
    error: "Este e-mail já está em uso.",
    proximo_passo: "Use outro e-mail para se cadastrar.",
  },
} as const;
