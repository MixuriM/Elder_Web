// Máscara de e-mail para listagens: primeiro caractere da parte local, "***", arroba e
// domínio completo (m***@gmail.com). Nulo/indefinido vira null; malformado vira "***"
// (nunca devolve o texto original). Função pura, sem imports.
export function mascararEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined) return null;
  const arroba = email.indexOf("@");
  const valido = arroba >= 1 && arroba < email.length - 1 && email.indexOf("@", arroba + 1) === -1;
  return valido ? `${email[0]}***${email.slice(arroba)}` : "***";
}
