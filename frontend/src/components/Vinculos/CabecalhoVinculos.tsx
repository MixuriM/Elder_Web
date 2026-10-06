import { UserPlus } from "lucide-react";

type CabecalhoVinculosProps = {
  onAdicionar: () => void;
};

export default function CabecalhoVinculos({
  onAdicionar,
}: CabecalhoVinculosProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
          Meus vínculos
        </h1>

        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
          Gerencie familiares e cuidadores que ajudam nos seus cuidados.
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
        <UserPlus size={22} />
        Adicionar pessoa
      </button>
    </header>
  );
}