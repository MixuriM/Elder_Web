import { useEffect, useId, useRef, useState } from "react";

import { chamarApi } from "../../lib/chamarApi";
import ConfirmacaoInline from "./ConfirmacaoInline";
import { MENSAGEM_ERRO, MENSAGEM_SUCESSO } from "./estilosVinculo";
import { mensagemPorStatus } from "./mensagensVinculo";

type Campo = "permite_registrar_saude" | "permite_marcar_dose" | "permite_criar_evento_cuidado";
type Permissoes = Record<Campo, boolean>;

type PermissoesCuidadorProps = {
  vinculoId: number;
  nome: string;
  permissoes: Permissoes | null | undefined;
  // Só quem decide pelo idoso (modo de decisão) edita; o backend continua barrando com 403.
  podeEditar: boolean;
};

const ITENS: { campo: Campo; rotulo: string; descricao: string; confirmar?: (nome: string) => [string, string] }[] = [
  {
    campo: "permite_registrar_saude",
    rotulo: "Registrar dados de saúde",
    descricao: "Pode registrar medidas de saúde do idoso.",
    confirmar: (nome) => [
      `Permitir que ${nome} registre dados de saúde?`,
      "São dados sensíveis do idoso. Você pode desligar esta permissão quando quiser.",
    ],
  },
  {
    campo: "permite_marcar_dose",
    rotulo: "Marcar doses de remédio",
    descricao: "Pode marcar que o idoso tomou o remédio.",
    confirmar: (nome) => [
      `Permitir que ${nome} marque doses de remédio?`,
      "A pessoa poderá marcar que o idoso tomou o remédio. Você pode desligar esta permissão quando quiser.",
    ],
  },
  {
    campo: "permite_criar_evento_cuidado",
    rotulo: "Compromissos de cuidado",
    descricao: "Pode criar na agenda compromissos do tipo cuidado.",
  },
];

const ERROS: Partial<Record<number, string>> = {
  400: "Não foi possível alterar esta permissão.",
  403: "Você não pode alterar estas permissões.",
  404: "Vínculo não encontrado.",
  409: "As permissões só podem ser alteradas em vínculo aprovado.",
};

export default function PermissoesCuidador({ vinculoId, nome, permissoes, podeEditar }: PermissoesCuidadorProps) {
  const idTitulo = useId();
  const [valores, setValores] = useState<Permissoes | null>(permissoes ?? null);
  const [enviando, setEnviando] = useState<Campo | null>(null);
  const [confirmando, setConfirmando] = useState<Campo | null>(null);
  const [devolverFoco, setDevolverFoco] = useState<Campo | null>(null);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");
  const botoes = useRef(new Map<Campo, HTMLButtonElement>());

  useEffect(() => {
    if (devolverFoco && confirmando === null) {
      botoes.current.get(devolverFoco)?.focus();
      setDevolverFoco(null);
    }
  }, [devolverFoco, confirmando]);

  if (!valores) {
    return (
      <section aria-labelledby={idTitulo} className="space-y-3">
        <h2 id={idTitulo} className="text-2xl font-bold text-[#071A38] dark:text-white">
          O que {nome} pode fazer
        </h2>
        <p className="text-lg text-gray-700 dark:text-gray-200">Permissões não disponíveis.</p>
      </section>
    );
  }

  async function enviar(campo: Campo, novo: boolean) {
    const anterior = valores as Permissoes;
    const rotulo = ITENS.find((i) => i.campo === campo)?.rotulo ?? "";
    setConfirmando(null);
    setErro("");
    setResultado("");
    setEnviando(campo);
    // Mostra o novo estado já; se o envio falhar, volta ao anterior.
    setValores({ ...anterior, [campo]: novo });
    try {
      const resposta = await chamarApi(`/vinculo/${vinculoId}/definir-permissoes`, {
        method: "PATCH",
        body: JSON.stringify({ [campo]: novo }),
      });
      setValores({
        permite_registrar_saude: resposta?.permite_registrar_saude ?? anterior.permite_registrar_saude,
        permite_marcar_dose: resposta?.permite_marcar_dose ?? anterior.permite_marcar_dose,
        permite_criar_evento_cuidado: resposta?.permite_criar_evento_cuidado ?? anterior.permite_criar_evento_cuidado,
        [campo]: novo,
      });
      setResultado(`${rotulo}: ${novo ? "ligado" : "desligado"}.`);
    } catch (e) {
      setValores(anterior);
      setErro(mensagemPorStatus(e, ERROS));
    } finally {
      setEnviando(null);
    }
  }

  function alternar(campo: Campo) {
    const ligando = !(valores as Permissoes)[campo];
    const item = ITENS.find((i) => i.campo === campo);
    if (ligando && item?.confirmar) {
      setErro("");
      setResultado("");
      setConfirmando(campo);
      return;
    }
    void enviar(campo, ligando);
  }

  return (
    <section aria-labelledby={idTitulo} className="space-y-4">
      <h2 id={idTitulo} className="text-2xl font-bold text-[#071A38] dark:text-white">
        O que {nome} pode fazer
      </h2>

      {!podeEditar && (
        <p className="text-lg text-gray-700 dark:text-gray-200">
          Só quem decide pelo idoso pode mudar estas permissões.
        </p>
      )}

      <ul className="space-y-3">
        {ITENS.map(({ campo, rotulo, descricao, confirmar }) => {
          const ligado = valores[campo];
          const idRotulo = `${idTitulo}-${campo}`;
          const textoConfirmar = confirmar?.(nome);

          return (
            <li
              key={campo}
              className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p id={idRotulo} className="text-lg font-bold text-[#071A38] dark:text-white">
                    {rotulo}
                  </p>
                  <p id={`${idRotulo}-desc`} className="text-base text-gray-700 dark:text-gray-200">
                    {descricao}
                  </p>
                </div>

                {podeEditar ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ligado}
                    aria-labelledby={idRotulo}
                    aria-describedby={`${idRotulo}-desc`}
                    disabled={enviando !== null}
                    ref={(el) => {
                      if (el) botoes.current.set(campo, el);
                      else botoes.current.delete(campo);
                    }}
                    onClick={() => alternar(campo)}
                    className={`min-h-12 min-w-36 rounded-xl border-2 px-4 py-2 text-lg font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5F56EC] disabled:cursor-not-allowed disabled:opacity-70 ${
                      ligado
                        ? "border-[#067647] bg-[#ECFDF3] text-[#054F31] dark:border-[#47CD89] dark:bg-[#12332A] dark:text-[#A6F4C5]"
                        : "border-[#475467] bg-white text-[#344054] dark:border-[#98A2B3] dark:bg-[#20202A] dark:text-[#D0D5DD]"
                    }`}
                  >
                    {ligado ? "Ligado" : "Desligado"}
                  </button>
                ) : (
                  <span className="text-lg font-bold text-[#071A38] dark:text-white">
                    {ligado ? "Ligado" : "Desligado"}
                  </span>
                )}
              </div>

              {confirmando === campo && textoConfirmar && (
                <ConfirmacaoInline
                  titulo={textoConfirmar[0]}
                  texto={textoConfirmar[1]}
                  rotuloConfirmar="Sim, permitir"
                  onConfirmar={() => enviar(campo, true)}
                  onCancelar={() => {
                    setDevolverFoco(campo);
                    setConfirmando(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>

      {podeEditar && (
        <>
          {/* Sempre no DOM: leitores de tela só anunciam mudanças de uma região que já existia. */}
          <div role="status" className={resultado ? MENSAGEM_SUCESSO : undefined}>
            {resultado}
          </div>
          {erro && (
            <p role="alert" className={MENSAGEM_ERRO}>
              {erro}
            </p>
          )}
        </>
      )}
    </section>
  );
}
