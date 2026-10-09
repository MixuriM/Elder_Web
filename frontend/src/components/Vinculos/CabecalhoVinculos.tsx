import { ArrowLeft, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import BotaoTema from "../layout/BotaoTema";

type CabecalhoVinculosProps = {
  titulo: string;
  descricao: string;
  onAdicionar: () => void;
};

export default function CabecalhoVinculos({
  titulo,
  descricao,
  onAdicionar,
}: CabecalhoVinculosProps) {
  return (
    <header className="space-y-6">
      <nav aria-label="Navegação da página" className="flex items-center justify-between">
        <Link
          to="/Home"
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

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
            {titulo}
          </h1>

          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
            {descricao}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdicionar}
          className="
            flex min-h-12 items-center justify-center gap-2
            rounded-xl bg-[#5F56EC] px-5 py-3
            text-lg font-semibold text-white
            transition hover:bg-[#5B53E8]
            focus:outline-none focus:ring-4 focus:ring-[#A18BFF]/40
          "
        >
          <UserPlus size={22} aria-hidden="true" />
          Adicionar pessoa
        </button>
      </div>
    </header>
  );
}