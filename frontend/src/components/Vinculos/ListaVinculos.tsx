import CardVinculo, { type Vinculo } from "./CardVinculo";

type ListaVinculosProps = {
  vinculos: Vinculo[];
  carregando?: boolean;
  erro?: string | null;
  vazio?: { titulo: string; texto: string };
};

export default function ListaVinculos({
  vinculos,
  carregando = false,
  erro,
  vazio = {
    titulo: "Nenhum vínculo encontrado",
    texto: "Quando você adicionar um familiar ou cuidador, ele aparecerá aqui.",
  },
}: ListaVinculosProps) {
  if (carregando) {
    return (
      <p className="py-8 text-center text-lg text-gray-600 dark:text-gray-300">
        Carregando vínculos...
      </p>
    );
  }

  if (erro) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-red-50 p-4 text-lg text-red-700"
      >
        {erro}
      </p>
    );
  }

  if (vinculos.length === 0) {
    return (
      <div className="rounded-2xl bg-[#F3F0FF] p-8 text-center dark:bg-[#151B35]">
        <h2 className="text-xl font-bold text-[#071A38] dark:text-white">
          {vazio.titulo}
        </h2>

        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {vazio.texto}
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="mb-5 text-2xl font-bold text-[#071A38] dark:text-white">
        Pessoas vinculadas
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vinculos.map((vinculo) => (
          <CardVinculo
            key={vinculo.id}
            vinculo={vinculo}
          />
        ))}
      </div>
    </section>
  );
}