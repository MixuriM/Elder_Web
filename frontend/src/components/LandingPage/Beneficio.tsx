// Define as propriedades recebidas pelo componente
type BeneficioProps = {
  icone: string;
  titulo: string;
  descricao: string;
};

// Componente responsável por exibir cada benefício da plataforma
function Beneficio({
  icone,
  titulo,
  descricao,
}: BeneficioProps) {
  return (
    <div className="flex items-center gap-4">

      {/* Área do ícone */}
      <div
        className="
          flex
          h-14
          w-14
          shrink-0
          items-center
          justify-center
          rounded-full

          bg-[#E5E1FF]
          text-2xl
          text-[#6C63FF]

          dark:bg-[#2A2840]
          dark:text-[#A89FFF]

          transition-colors
          duration-300
        "
      >
        {icone}
      </div>

      {/* Informações do benefício */}
      <div>
        {/* Título */}
        <h3
          className="
            text-xl
            font-bold

            text-[#071A38]
            dark:text-[#F5F5FA]

            transition-colors
            duration-300
          "
        >
          {titulo}
        </h3>

        {/* Descrição */}
        <p
          className="
            mt-1
            text-lg

            text-[#56657D]
            dark:text-[#B9B9C5]

            transition-colors
            duration-300
          "
        >
          {descricao}
        </p>
      </div>

    </div>
  );
}

export default Beneficio;