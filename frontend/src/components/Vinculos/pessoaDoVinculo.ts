import type { Vinculo } from "./CardVinculo";

// Quem aparece no cartão depende de quem está logado: "vinculado" é o próprio cuidador ou familiar,
// então a pessoa a mostrar é o idoso (oculto pelo backend até o vínculo ser aprovado).
export function pessoaDoVinculo(vinculo: Vinculo) {
  if (vinculo.papel_do_chamador === "vinculado") {
    return {
      nome: vinculo.idoso.nome ?? "Idoso",
      email_mascarado: vinculo.idoso.email_mascarado,
    };
  }

  // Convite do idoso ainda sem resposta: o backend não manda nada da conta convidada (D4b, 2026-10-14).
  if (vinculo.origem === "convite_idoso" && vinculo.status === "pendente" && vinculo.vinculado.nome === null) {
    return { nome: "Convite enviado, aguardando resposta", email_mascarado: null };
  }

  return {
    nome: vinculo.vinculado.nome ?? "Pessoa vinculada",
    email_mascarado: vinculo.vinculado.email_mascarado,
  };
}
