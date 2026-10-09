import { Link } from "react-router-dom";

type CartaoSemVinculoProps = {
  tipoPerfil: "cuidador" | "familiar";
  pendente: boolean;
};

// Substitui os cards de módulos (escondidos até haver ao menos 1 vínculo aprovado).
function CartaoSemVinculo({ tipoPerfil, pendente }: CartaoSemVinculoProps) {
  const destino = tipoPerfil === "cuidador" ? "/cuidadores" : "/familia";

  return (
    <section
      aria-labelledby="titulo-sem-vinculo"
      className="
        rounded-2xl
        border
        border-[#DDD7FF]
        bg-white
        p-5
        shadow-sm

        dark:border-[#454A63]
        dark:bg-[#1F2130]

        sm:p-6
      "
    >
      <h2
        id="titulo-sem-vinculo"
        className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]"
      >
        {pendente ? "Aguardando aprovação" : "Vincule-se a um idoso"}
      </h2>

      <p className="mt-2 text-base text-slate-700 dark:text-[#C7C7D1]">
        {pendente
          ? "Seu pedido de vínculo ainda aguarda aprovação. Quando for aprovado, saúde, medicamentos, agenda e alimentação ficam disponíveis."
          : "Para usar saúde, medicamentos, agenda e alimentação, vincule-se a um idoso."}
      </p>

      <Link
        to={destino}
        className="
          mt-4
          inline-flex
          min-h-12
          items-center
          justify-center
          rounded-xl
          bg-[#5F56EC]
          px-5
          py-3
          text-base
          font-semibold
          text-white
          hover:bg-[#554CD8]
        "
      >
        {pendente ? "Ver meus vínculos" : "Ir para os vínculos"}
      </Link>
    </section>
  );
}

export default CartaoSemVinculo;
