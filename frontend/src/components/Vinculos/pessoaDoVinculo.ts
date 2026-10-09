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

  return {
    nome: vinculo.vinculado.nome ?? "Pessoa vinculada",
    email_mascarado: vinculo.vinculado.email_mascarado,
  };
}
