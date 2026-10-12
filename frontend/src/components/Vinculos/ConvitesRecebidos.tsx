import { useEffect, useId, useRef, useState } from "react";

import { chamarApi } from "../../lib/chamarApi";
import type { Vinculo } from "./CardVinculo";
import ConfirmacaoInline from "./ConfirmacaoInline";
import { BOTAO_PERIGO, BOTAO_PRIMARIO, MENSAGEM_ERRO, MENSAGEM_SUCESSO } from "./estilosVinculo";
import { ERRO_PADRAO, mensagemPorStatus, statusDoErro } from "./mensagensVinculo";
import { pessoaDoVinculo } from "./pessoaDoVinculo";
import { ehConviteDeCuidador, ehConviteVencido, formatarDataBR } from "./regrasVinculo";

type ConvitesRecebidosProps = {
  vinculos: Vinculo[];
  // A página recarrega a lista, o resumo e o acesso (aceitar libera Saúde, Medicamentos, Agenda e Alimentação).
  onResolvido: () => void;
};

type Acao = "aceitar" | "recusar";

const ERROS_ACEITAR: Partial<Record<number, string>> = {
  403: "Confirme o seu e-mail no Meu Perfil antes de aceitar.",
  404: "Este convite não foi encontrado. A lista foi atualizada.",
  409: "Este convite não vale mais. A lista foi atualizada.",
};
// Recusar nunca exige e-mail confirmado: sem texto para 403.
const ERROS_RECUSAR: Partial<Record<number, string>> = {
  404: ERROS_ACEITAR[404],
  409: ERROS_ACEITAR[409],
};

// Convites que um idoso mandou ao cuidador logado. Aceitar libera o acesso aos dados do idoso: só acontece no clique
// do cuidador. Recusar pede confirmação.
export default function ConvitesRecebidos({ vinculos, onResolvido }: ConvitesRecebidosProps) {
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<{ id: number; texto: string } | null>(null);
  const [resultado, setResultado] = useState("");
  // O botão Recusar some enquanto a confirmação aparece: o foco volta a ele pela chave do convite.
  const botoesRecusar = useRef(new Map<number, HTMLButtonElement>());
  const [devolverFoco, setDevolverFoco] = useState<number | null>(null);
  const idTitulo = useId();

  const convites = vinculos.filter(
    (v) => v.papel_do_chamador === "vinculado" && ehConviteDeCuidador(v) && v.status === "pendente",
  );

  useEffect(() => {
    if (devolverFoco !== null && confirmandoId === null) {
      botoesRecusar.current.get(devolverFoco)?.focus();
      setDevolverFoco(null);
    }
  }, [devolverFoco, confirmandoId]);

  async function executar(v: Vinculo, acao: Acao) {
    const { nome } = pessoaDoVinculo(v);
    setEnviandoId(v.id);
    setErro(null);
    setResultado("");
    try {
      await chamarApi(`/vinculo/${v.id}/${acao}-convite`, { method: "POST" });
      setConfirmandoId(null);
      setResultado(acao === "aceitar" ? `Convite de ${nome} aceito.` : `Convite de ${nome} recusado.`);
      onResolvido();
    } catch (e) {
      const status = statusDoErro(e);
      setConfirmandoId(null);
      setErro({
        id: v.id,
        texto: mensagemPorStatus(e, acao === "aceitar" ? ERROS_ACEITAR : ERROS_RECUSAR, ERRO_PADRAO),
      });
      // 404 e 409: a tela estava desatualizada.
      if (status === 404 || status === 409) onResolvido();
    } finally {
      setEnviandoId(null);
    }
  }

  function cancelarConfirmacao() {
    if (confirmandoId !== null) setDevolverFoco(confirmandoId);
    setConfirmandoId(null);
  }

  function pedirConfirmacao(id: number) {
    setErro(null);
    setResultado("");
    setConfirmandoId(id);
  }

  return (
    <div className="space-y-8">
      {/* Sempre no DOM: leitores de tela só anunciam mudanças de uma região que já existia. */}
      <div role="status" className={resultado ? MENSAGEM_SUCESSO : undefined}>
        {resultado}
      </div>

      {convites.length > 0 && (
        <section aria-labelledby={idTitulo}>
          <h2 id={idTitulo} className="mb-5 text-2xl font-bold text-[#071A38] dark:text-white">
            Convites para você
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {convites.map((v) => {
              const { nome, email_mascarado: email } = pessoaDoVinculo(v);
              const enviando = enviandoId === v.id;
              const vencido = ehConviteVencido(v);
              const idNome = `${idTitulo}-nome-${v.id}`;

              return (
                <article
                  key={v.id}
                  aria-labelledby={idNome}
                  className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#151B35]"
                >
                  <div>
                    <h3 id={idNome} className="break-words text-xl font-bold text-[#071A38] dark:text-white">
                      {nome}
                    </h3>
                    <p className="text-lg text-gray-700 dark:text-gray-200">Convidou você para ser cuidador dele</p>
                    {email && <p className="break-words text-base text-gray-700 dark:text-gray-200">E-mail: {email}</p>}
                    <p className="text-base text-gray-700 dark:text-gray-200">
                      Convite enviado em {formatarDataBR(v.data_solicitacao)}
                    </p>
                    {/* Texto, não só cor: o backend continua sendo a barreira (409 ao aceitar convite vencido). */}
                    {vencido && (
                      <p className="mt-2 text-lg font-semibold text-[#071A38] dark:text-white">
                        Convite vencido. Peça um novo convite ao idoso.
                      </p>
                    )}
                  </div>

                  {confirmandoId === v.id && (
                    <ConfirmacaoInline
                      titulo={`Recusar o convite de ${nome}?`}
                      texto="Você não terá acesso aos dados dessa pessoa. Ela poderá convidar você de novo depois."
                      rotuloConfirmar="Sim, recusar"
                      perigo
                      enviando={enviando}
                      onConfirmar={() => executar(v, "recusar")}
                      onCancelar={cancelarConfirmacao}
                    />
                  )}

                  {erro?.id === v.id && (
                    <p role="alert" className={MENSAGEM_ERRO}>
                      {erro.texto}
                    </p>
                  )}

                  {confirmandoId !== v.id && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {!vencido && (
                        <button
                          type="button"
                          disabled={enviando}
                          aria-busy={enviando}
                          aria-label={`Aceitar o convite de ${nome}`}
                          onClick={() => executar(v, "aceitar")}
                          className={BOTAO_PRIMARIO}
                        >
                          Aceitar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={enviando}
                        aria-label={`Recusar o convite de ${nome}`}
                        ref={(el) => {
                          if (el) botoesRecusar.current.set(v.id, el);
                          else botoesRecusar.current.delete(v.id);
                        }}
                        onClick={() => pedirConfirmacao(v.id)}
                        className={BOTAO_PERIGO}
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
