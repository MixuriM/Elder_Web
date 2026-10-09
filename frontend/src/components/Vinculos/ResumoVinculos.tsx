import type { Vinculo } from "./CardVinculo";

type ResumoVinculosProps = {
  vinculos: Vinculo[];
  tipo: "familiar" | "cuidador";
};

const NOMES = {
  familiar: { um: "familiar vinculado", varios: "familiares vinculados", nenhum: "Nenhum familiar vinculado" },
  cuidador: { um: "cuidador vinculado", varios: "cuidadores vinculados", nenhum: "Nenhum cuidador vinculado" },
};

export default function ResumoVinculos({ vinculos, tipo }: ResumoVinculosProps) {
  const aprovados = vinculos.filter((v) => v.status === "aprovado").length;
  const pendentes = vinculos.filter((v) => v.status === "pendente").length;
  const nomes = NOMES[tipo];

  const textoAprovados =
    aprovados === 0 ? nomes.nenhum : `${aprovados} ${aprovados === 1 ? nomes.um : nomes.varios}`;
  const textoPendentes =
    pendentes === 0
      ? "Nenhum pedido aguardando resposta"
      : `${pendentes} ${pendentes === 1 ? "pedido aguardando" : "pedidos aguardando"} resposta`;

  return (
    <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2">
      <p className="rounded-2xl bg-[#F3F0FF] p-4 text-lg font-semibold text-[#071A38] dark:bg-[#242A4A] dark:text-white">
        {textoAprovados}
      </p>
      <p className="rounded-2xl bg-[#F3F0FF] p-4 text-lg font-semibold text-[#071A38] dark:bg-[#242A4A] dark:text-white">
        {textoPendentes}
      </p>
    </section>
  );
}
