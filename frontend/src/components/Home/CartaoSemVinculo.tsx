import { Link } from "react-router-dom";

type CartaoSemVinculoProps = {
  tipoPerfil: "cuidador" | "familiar";
  pendente: boolean;
  // Só cuidador: há um convite do idoso dentro do prazo esperando o aceite dele. Quem decide é ele, não um terceiro.
  convite?: boolean;
};

// Substitui os cards de módulos (escondidos até haver ao menos 1 vínculo aprovado).
function CartaoSemVinculo({ tipoPerfil, pendente, convite = false }: CartaoSemVinculoProps) {
  const destino = tipoPerfil === "cuidador" ? "/cuidadores" : "/familia";
  const comConvite = convite && tipoPerfil === "cuidador";

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
        {comConvite ? "Convite para ser cuidador" : pendente ? "Aguardando aprovação" : "Vincule-se a um idoso"}
      </h2>

      <p className="mt-2 text-base text-slate-700 dark:text-[#C7C7D1]">
        {comConvite
          ? "Você recebeu um convite para ser cuidador. Abra Cuidadores para aceitar."
          : pendente
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
        {comConvite ? "Abrir Cuidadores" : pendente ? "Ver meus vínculos" : "Ir para os vínculos"}
      </Link>
    </section>
  );
}

export default CartaoSemVinculo;
