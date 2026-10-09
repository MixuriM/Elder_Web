export type TipoVinculo = "familiar" | "cuidador";
export type AcaoAdicionar = "solicitar" | "cadastrar";

// Só o que o backend deixa cada perfil fazer: cuidador pede vínculo de cuidador; familiar pede vínculo de
// familiar ou cadastra idoso. Idoso não tem rota para isso (não existe rota de convite do idoso).
export function acoesDoPerfil(tipoPerfil: string | null, tipo: TipoVinculo): AcaoAdicionar[] {
  if (tipoPerfil === "cuidador" && tipo === "cuidador") return ["solicitar"];
  if (tipoPerfil === "familiar" && tipo === "familiar") return ["solicitar", "cadastrar"];
  return [];
}
