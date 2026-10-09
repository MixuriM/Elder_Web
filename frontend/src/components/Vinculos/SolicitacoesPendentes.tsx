import { useEffect, useId, useRef, useState } from "react";

import { chamarApi } from "../../lib/chamarApi";
import AvisoEmailPendente from "./AvisoEmailPendente";
import type { Vinculo } from "./CardVinculo";
import ConfirmacaoInline from "./ConfirmacaoInline";
import { BOTAO_PERIGO, BOTAO_PRIMARIO, MENSAGEM_ERRO, MENSAGEM_SUCESSO } from "./estilosVinculo";
import { ERRO_PADRAO, mensagemPorStatus, statusDoErro } from "./mensagensVinculo";
import { pessoaDoVinculo } from "./pessoaDoVinculo";
import {
  emailNaoConfirmado,
  formatarDataBR,
  podeContestar,
  temAutoridade,
  type ModoDecisao,
} from "./regrasVinculo";

type SolicitacoesPendentesProps = {
  vinculos: Vinculo[];
  tipoPerfil: string | null;
  modoDoIdoso: ModoDecisao;
  // A página recarrega a lista e o resumo.
  onResolvido: () => void;
};

type Acao = "aprovar" | "recusar" | "contestar";

const ERROS_RESPONDER: Partial<Record<number, string>> = {
  403: "Você não pode responder a este pedido.",
  404: "Este pedido não foi encontrado. A lista foi atualizada.",
  409: "Este pedido já foi respondido. A lista foi atualizada.",
};
const ERROS_CONTESTAR: Partial<Record<number, string>> = {
  400: "Este vínculo não pode ser contestado.",
  403: "Você não pode contestar este vínculo.",
  404: "Este vínculo não foi encontrado. A lista foi atualizada.",
  409: "Este vínculo não está mais aprovado. A lista foi atualizada.",
};

export default function SolicitacoesPendentes({
  vinculos,
  tipoPerfil,
  modoDoIdoso,
  onResolvido,
}: SolicitacoesPendentesProps) {
  const [confirmando, setConfirmando] = useState<{ id: number; acao: "recusar" | "contestar" } | null>(null);
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<{ id: number; texto: string } | null>(null);
  const [resultado, setResultado] = useState("");
  // Os botões somem enquanto a confirmação aparece: o foco volta a eles pela chave "id-acao".
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const [devolverFoco, setDevolverFoco] = useState<string | null>(null);
  const idPedidos = useId();
  const idConferir = useId();

  const paraResponder = vinculos.filter((v) => v.status === "pendente" && temAutoridade(v, tipoPerfil, modoDoIdoso));
  const paraConferir = vinculos.filter((v) => podeContestar(v, tipoPerfil, modoDoIdoso));

  useEffect(() => {
    if (devolverFoco && confirmando === null) {
      botoes.current.get(devolverFoco)?.focus();
      setDevolverFoco(null);
    }
  }, [devolverFoco, confirmando]);

  async function executar(v: Vinculo, acao: Acao) {
    const { nome } = pessoaDoVinculo(v);
    setEnviandoId(v.id);
    setErro(null);
    setResultado("");
    try {
      await chamarApi(`/vinculo/${v.id}/${acao}`, { method: "POST" });
      setConfirmando(null);
      setResultado(
        acao === "aprovar"
          ? `Pedido de ${nome} aprovado.`
          : acao === "recusar"
            ? `Pedido de ${nome} recusado.`
            : `Vínculo de ${nome} contestado e desfeito.`,
      );
      onResolvido();
    } catch (e) {
      const status = statusDoErro(e);
      setConfirmando(null);
      setErro({
        id: v.id,
        texto: mensagemPorStatus(e, acao === "contestar" ? ERROS_CONTESTAR : ERROS_RESPONDER, ERRO_PADRAO),
      });
      // 404 e 409: a tela estava desatualizada.
      if (status === 404 || status === 409) onResolvido();
    } finally {
      setEnviandoId(null);
    }
  }

  function cancelarConfirmacao() {
    if (confirmando) setDevolverFoco(`${confirmando.id}-${confirmando.acao}`);
    setConfirmando(null);
  }

  function pedirConfirmacao(id: number, acao: "recusar" | "contestar") {
    setErro(null);
    setResultado("");
    setConfirmando({ id, acao });
  }

  function guardarBotao(id: number, acao: string, el: HTMLButtonElement | null) {
    if (el) botoes.current.set(`${id}-${acao}`, el);
    else botoes.current.delete(`${id}-${acao}`);
  }

  function renderItem(v: Vinculo, acoes: Acao[]) {
    const { nome, email_mascarado: email } = pessoaDoVinculo(v);
    const enviando = enviandoId === v.id;
    const emConfirmacao = confirmando?.id === v.id ? confirmando.acao : null;
    const idNome = `${idPedidos}-nome-${v.id}`;
    const quer = v.tipo_vinculo === "cuidador" ? "cuidador" : "familiar";

    return (
      <article
        key={v.id}
        aria-labelledby={idNome}
        className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#151B35]"
      >
        <div>
          <h3 id={idNome} className="text-xl font-bold text-[#071A38] dark:text-white">
            {nome}
          </h3>
          {v.status === "pendente" ? (
            <p className="text-lg text-gray-700 dark:text-gray-200">
              Quer ser seu {quer}
              {v.papel_do_chamador === "titular" && v.idoso.nome ? ` · Idoso: ${v.idoso.nome}` : ""}
            </p>
          ) : (
            <p className="text-lg text-gray-700 dark:text-gray-200">
              Familiar com vínculo automático
              {v.papel_do_chamador === "titular" && v.idoso.nome ? ` · Idoso: ${v.idoso.nome}` : ""}
            </p>
          )}
          {email && <p className="text-base text-gray-700 dark:text-gray-200">E-mail: {email}</p>}
          <p className="text-base text-gray-700 dark:text-gray-200">
            Pedido feito em {formatarDataBR(v.data_solicitacao)}
          </p>
        </div>

        {emailNaoConfirmado(v) && <AvisoEmailPendente />}

        {emConfirmacao === "recusar" && (
          <ConfirmacaoInline
            titulo={`Recusar o pedido de ${nome}?`}
            texto="A pessoa não terá acesso. Ela poderá fazer um novo pedido depois."
            rotuloConfirmar="Sim, recusar"
            perigo
            enviando={enviando}
            onConfirmar={() => executar(v, "recusar")}
            onCancelar={cancelarConfirmacao}
          />
        )}
        {emConfirmacao === "contestar" && (
          <ConfirmacaoInline
            titulo={`Contestar o vínculo de ${nome}?`}
            texto="O vínculo será desfeito e a pessoa perde o acesso aos dados do idoso."
            rotuloConfirmar="Sim, contestar"
            perigo
            enviando={enviando}
            onConfirmar={() => executar(v, "contestar")}
            onCancelar={cancelarConfirmacao}
          />
        )}

        {erro?.id === v.id && (
          <p role="alert" className={MENSAGEM_ERRO}>
            {erro.texto}
          </p>
        )}

        {emConfirmacao === null && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {acoes.includes("aprovar") && (
              <button
                type="button"
                disabled={enviando}
                aria-busy={enviando}
                aria-label={`Aprovar o pedido de ${nome}`}
                onClick={() => executar(v, "aprovar")}
                className={BOTAO_PRIMARIO}
              >
                Aprovar
              </button>
            )}
            {acoes.includes("recusar") && (
              <button
                type="button"
                disabled={enviando}
                aria-label={`Recusar o pedido de ${nome}`}
                ref={(el) => guardarBotao(v.id, "recusar", el)}
                onClick={() => pedirConfirmacao(v.id, "recusar")}
                className={BOTAO_PERIGO}
              >
                Recusar
              </button>
            )}
            {acoes.includes("contestar") && (
              <button
                type="button"
                disabled={enviando}
                aria-label={`Contestar o vínculo de ${nome}`}
                ref={(el) => guardarBotao(v.id, "contestar", el)}
                onClick={() => pedirConfirmacao(v.id, "contestar")}
                className={BOTAO_PERIGO}
              >
                Contestar
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sempre no DOM: leitores de tela só anunciam mudanças de uma região que já existia. */}
      <div role="status" className={resultado ? MENSAGEM_SUCESSO : undefined}>
        {resultado}
      </div>

      {paraResponder.length > 0 && (
        <section aria-labelledby={idPedidos}>
          <h2 id={idPedidos} className="mb-5 text-2xl font-bold text-[#071A38] dark:text-white">
            Pedidos para você responder
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {paraResponder.map((v) => renderItem(v, ["aprovar", "recusar"]))}
          </div>
        </section>
      )}

      {paraConferir.length > 0 && (
        <section aria-labelledby={idConferir}>
          <h2 id={idConferir} className="mb-2 text-2xl font-bold text-[#071A38] dark:text-white">
            Vínculos automáticos para conferir
          </h2>
          <p className="mb-5 text-lg text-gray-700 dark:text-gray-200">
            Estes familiares entraram sem pedido manual. Se não reconhece alguém, você pode contestar.
          </p>
          <div className="grid gap-4 md:grid-cols-2">{paraConferir.map((v) => renderItem(v, ["contestar"]))}</div>
        </section>
      )}
    </div>
  );
}
