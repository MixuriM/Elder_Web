import type { Vinculo } from "./CardVinculo";
import { ehConviteDeCuidador, ehConviteVencido } from "./regrasVinculo";

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
  // Convite de cuidador não é "pedido aguardando resposta": o idoso já consentiu e só falta o aceite do cuidador.
  const pendentes = vinculos.filter((v) => v.status === "pendente" && !ehConviteDeCuidador(v)).length;
  // Convite vencido (mais de 7 dias) não espera mais ninguém: fica fora de qualquer contagem de "aguardando".
  const convites = vinculos.filter((v) => v.status === "pendente" && ehConviteDeCuidador(v) && !ehConviteVencido(v));
  const paraResponder = convites.filter((v) => v.papel_do_chamador === "vinculado").length;
  const esperando = convites.length - paraResponder;
  const nomes = NOMES[tipo];

  const textoAprovados =
    aprovados === 0 ? nomes.nenhum : `${aprovados} ${aprovados === 1 ? nomes.um : nomes.varios}`;
  const textoPendentes =
    pendentes === 0
      ? "Nenhum pedido aguardando resposta"
      : `${pendentes} ${pendentes === 1 ? "pedido aguardando" : "pedidos aguardando"} resposta`;

  // Para o cuidador o convite espera a resposta dele; para o idoso e o titular, a do cuidador.
  const textosConvite = [
    paraResponder > 0 && `${paraResponder} ${paraResponder === 1 ? "convite" : "convites"} para você responder`,
    esperando > 0 && `${esperando} ${esperando === 1 ? "convite esperando" : "convites esperando"} o cuidador aceitar`,
  ].filter((texto): texto is string => typeof texto === "string");

  const classe =
    "rounded-2xl bg-[#F3F0FF] p-4 text-lg font-semibold text-[#071A38] dark:bg-[#242A4A] dark:text-white";

  return (
    <section aria-label="Resumo" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <p className={classe}>{textoAprovados}</p>
      <p className={classe}>{textoPendentes}</p>
      {textosConvite.map((texto) => (
        <p key={texto} className={classe}>
          {texto}
        </p>
      ))}
    </section>
  );
}
