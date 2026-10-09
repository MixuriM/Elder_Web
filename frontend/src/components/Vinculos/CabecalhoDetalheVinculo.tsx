import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import BotaoTema from "../layout/BotaoTema";

// Volta para a lista do tipo do vínculo; sem tipo conhecido (carregando ou erro), volta para o início.
const LISTA_POR_TIPO: Record<string, string> = {
  familiar: "/familia",
  cuidador: "/cuidadores",
};

export default function CabecalhoDetalheVinculo({ tipo }: { tipo?: string }) {
  return (
    <nav
      aria-label="Navegação da página"
      className="mx-auto mb-6 flex w-full max-w-2xl items-center justify-between"
    >
      <Link
        to={(tipo && LISTA_POR_TIPO[tipo]) || "/Home"}
        className="
          inline-flex min-h-11 items-center gap-2 rounded-xl
          border border-gray-300 bg-white px-4 font-semibold text-[#071A38]
          transition hover:border-[#A18BFF] hover:bg-[#F3F0FF]
          focus:outline-none focus:ring-4 focus:ring-[#A18BFF]/40
          dark:border-gray-700 dark:bg-[#151B35] dark:text-white dark:hover:bg-[#242A4A]
        "
      >
        <ArrowLeft size={20} aria-hidden="true" />
        Voltar
      </Link>

      <BotaoTema />
    </nav>
  );
}
