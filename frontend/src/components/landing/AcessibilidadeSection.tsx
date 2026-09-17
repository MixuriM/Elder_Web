import {
  Eye,
  Moon,
  MousePointer2,
  Type,
} from "lucide-react";

function AcessibilidadeSection() {
  return (
    <section
      id="acessibilidade"
      className="
        scroll-mt-24
        bg-[#F7F5FF]
        px-6
        py-24
        dark:bg-[#141420]
      "
    >
      <div
        className="
          mx-auto
          grid
          max-w-7xl
          gap-14
          lg:grid-cols-2
          lg:items-center
        "
      >
        {/* Texto */}
        <div>
          <span
            className="
              text-sm
              font-bold
              uppercase
              tracking-[0.2em]
              text-[#6C63FF]
              dark:text-[#9B95FF]
            "
          >
            Acessibilidade
          </span>

          <h2
            className="
              mt-4
              max-w-xl
              text-4xl
              font-bold
              leading-tight
              text-[#101828]
              dark:text-white
            "
          >
            Tecnologia que deve ser simples para{" "}
            <span className="text-[#6C63FF]">
              todos.
            </span>
          </h2>

          <p
            className="
              mt-6
              max-w-xl
              text-lg
              leading-8
              text-gray-600
              dark:text-gray-300
            "
          >
            O Elder busca oferecer uma experiência
            clara e confortável, reduzindo barreiras
            e facilitando o acesso às informações
            importantes do dia a dia.
          </p>
        </div>

        {/* Recursos */}
        <div
          className="
            grid
            gap-4
            sm:grid-cols-2
          "
        >
          <Item
            Icone={Type}
            titulo="Leitura facilitada"
            descricao="Textos claros e tamanhos confortáveis."
          />

          <Item
            Icone={Eye}
            titulo="Boa visualização"
            descricao="Contraste e organização visual."
          />

          <Item
            Icone={MousePointer2}
            titulo="Navegação simples"
            descricao="Ações importantes fáceis de encontrar."
          />

          <Item
            Icone={Moon}
            titulo="Tema claro e escuro"
            descricao="Escolha a visualização mais confortável."
          />
        </div>
      </div>
    </section>
  );
}

type ItemProps = {
  Icone: React.ElementType;
  titulo: string;
  descricao: string;
};

function Item({
  Icone,
  titulo,
  descricao,
}: ItemProps) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-[#E5E3FF]
        bg-white
        p-6

        dark:border-white/10
        dark:bg-[#1A1A27]
      "
    >
      <Icone
        size={27}
        className="
          text-[#6C63FF]
          dark:text-[#A7A2FF]
        "
      />

      <h3
        className="
          mt-4
          font-bold
          text-[#101828]
          dark:text-white
        "
      >
        {titulo}
      </h3>

      <p
        className="
          mt-2
          text-sm
          leading-6
          text-gray-500
          dark:text-gray-400
        "
      >
        {descricao}
      </p>
    </div>
  );
}

export default AcessibilidadeSection;