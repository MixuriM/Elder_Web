import { menuItems } from "../data/menuItems";
import type { Acesso } from "../contexts/useAcesso";
import type { MenuItem } from "../components/types/home";

const MODULOS_DE_DADOS = ["/saude", "/remedios", "/agenda", "/alimentacao"];
const SO_BASICOS = ["/Home", "/perfil", "/orientacoes"];

// Tabela D2. Carregando mostra só o básico; erro falha aberto (menu completo do perfil conhecido,
// ou todos se nem o perfil carregou): esconder módulo por falha de rede seria pior que mostrá-lo,
// porque o 403 do backend é a barreira real.
export function itensDoMenu({ estado, tipoPerfil, temVinculoAprovado }: Acesso): MenuItem[] {
  if (estado === "carregando") return menuItems.filter((i) => SO_BASICOS.includes(i.to));

  const semVinculo =
    estado === "ok" && (tipoPerfil === "familiar" || tipoPerfil === "cuidador") && !temVinculoAprovado;

  return menuItems.filter((i) => {
    if (tipoPerfil === "cuidador" && i.to === "/familia") return false;
    if (semVinculo && MODULOS_DE_DADOS.includes(i.to)) return false;
    if (semVinculo && tipoPerfil === "familiar" && i.to === "/cuidadores") return false;
    return true;
  });
}
