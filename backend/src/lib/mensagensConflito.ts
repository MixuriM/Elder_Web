// Item 3.2 (RNF-011) — corpo dos 409 de conflito de e-mail no cadastro.
// Nunca inclua aqui nome, e-mail, id ou tipo de outra conta.
export const CONFLITO_EMAIL = {
  EMAIL_JA_EM_USO_CADASTRO_IDOSO: {
    codigo: "EMAIL_JA_EM_USO_CADASTRO_IDOSO",
    error: "Já existe uma conta com este e-mail.",
    proximo_passo:
      "Se essa pessoa é o idoso que você quer acompanhar, use 'Solicitar vínculo' informando este e-mail. Se não, confira se o e-mail foi digitado corretamente.",
  },
  // Devolvido em POST /auth/sync quando o e-mail já pertence a um idoso cadastrado por
  // Familiar (RF-030) e o token de quem está tentando o cadastro ainda não está
  // verificado — a anexação automática do firebase_uid (item 3.3) só roda com
  // email_verified=true. Confirmando o e-mail, a próxima chamada de /auth/sync anexa a
  // conta existente sozinha, sem suporte manual.
  EMAIL_CADASTRADO_POR_FAMILIAR: {
    codigo: "EMAIL_CADASTRADO_POR_FAMILIAR",
    error: "Este e-mail já foi cadastrado por um familiar.",
    proximo_passo:
      "Confirme seu e-mail pelo link que enviamos. Assim que confirmado, você assume automaticamente a conta criada pelo familiar, sem precisar de suporte.",
  },
  EMAIL_JA_EM_USO: {
    codigo: "EMAIL_JA_EM_USO",
    error: "Este e-mail já está em uso.",
    proximo_passo: "Use outro e-mail para se cadastrar.",
  },
} as const;
