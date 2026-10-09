import { useId, useRef, useState } from "react";

import { chamarApi } from "../../lib/chamarApi";
import type { DecisaoDoIdoso, Vinculo } from "./CardVinculo";
import ConfirmacaoInline from "./ConfirmacaoInline";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CAMPO,
  MENSAGEM_ERRO,
  MENSAGEM_SUCESSO,
  ROTULO,
} from "./estilosVinculo";
import { mensagemPorStatus } from "./mensagensVinculo";
import { formatarDataBR } from "./regrasVinculo";
import { modoDe, type useEstadoDecisao } from "./useEstadoDecisao";

export type DecisaoApi = ReturnType<typeof useEstadoDecisao>;

type ModoDecisaoProps = {
  tipoPerfil: string | null;
  vinculos: Vinculo[];
  decisao: DecisaoApi;
};

// Quem decide por mim (RF-033, RF-034): o idoso muda direto; o familiar só pede ou confirma um pedido.
// O backend não devolve ao familiar o estado do idoso, então a tela do familiar só age e trata a resposta.
export default function ModoDecisao({ tipoPerfil, vinculos, decisao }: ModoDecisaoProps) {
  if (tipoPerfil === "idoso") return <ModoDoIdoso vinculos={vinculos} decisao={decisao} />;
  if (tipoPerfil === "familiar") return <ModoDoFamiliar vinculos={vinculos} />;
  return null;
}

type AcaoIdoso = "passar" | "voltar" | "cancelar" | "aceitar";

const PASSAR_TEXTO =
  "Seus familiares com vínculo aprovado poderão aprovar pedidos de vínculo e liberar permissões no seu lugar. Você pode voltar a decidir quando quiser.";

const ACOES_IDOSO: Record<
  AcaoIdoso,
  { alvo: "idoso" | "familiar"; botao: string; titulo: string; texto: string; confirmar: string; ok: string }
> = {
  passar: {
    alvo: "familiar",
    botao: "Passar a decisão para minha família",
    titulo: "Passar a decisão para a sua família?",
    texto: PASSAR_TEXTO,
    confirmar: "Sim, passar a decisão",
    ok: "Agora a sua família decide por você.",
  },
  voltar: {
    alvo: "idoso",
    botao: "Voltar a decidir eu mesmo",
    titulo: "Voltar a decidir você mesmo?",
    texto: "Seus familiares deixam de aprovar pedidos e liberar permissões por você.",
    confirmar: "Sim, voltar a decidir",
    ok: "Agora você decide.",
  },
  cancelar: {
    alvo: "idoso",
    botao: "Cancelar o pedido de transferência",
    titulo: "Cancelar o pedido do seu familiar?",
    texto: "Você continua decidindo. O familiar poderá fazer um novo pedido depois.",
    confirmar: "Sim, cancelar o pedido",
    ok: "Pedido cancelado. Você continua decidindo.",
  },
  aceitar: {
    alvo: "familiar",
    botao: "Aceitar o pedido agora",
    titulo: "Passar a decisão para a sua família agora?",
    texto: PASSAR_TEXTO,
    confirmar: "Sim, passar a decisão",
    ok: "Agora a sua família decide por você.",
  },
};

const ERROS_IDOSO: Partial<Record<number, string>> = {
  400: "Não foi possível fazer a alteração. Tente de novo.",
  403: "Você não pode fazer esta alteração.",
  409: "Para passar a decisão, você precisa de pelo menos um familiar com vínculo aprovado.",
};

function ModoDoIdoso({ vinculos, decisao }: { vinculos: Vinculo[]; decisao: DecisaoApi }) {
  const idTitulo = useId();
  const [confirmando, setConfirmando] = useState<AcaoIdoso | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");
  const botoes = useRef(new Map<AcaoIdoso, HTMLButtonElement>());
  const { estado } = decisao;

  async function enviar(acao: AcaoIdoso) {
    setEnviando(true);
    setErro("");
    setResultado("");
    try {
      const novo = await chamarApi("/usuario/me/modo-decisao", {
        method: "PATCH",
        body: JSON.stringify({ modo_decisao: ACOES_IDOSO[acao].alvo }),
      });
      decisao.atualizar(novo);
      setConfirmando(null);
      setResultado(ACOES_IDOSO[acao].ok);
    } catch (e) {
      setConfirmando(null);
      setErro(mensagemPorStatus(e, ERROS_IDOSO));
    } finally {
      setEnviando(false);
    }
  }

  function pedir(acao: AcaoIdoso) {
    setErro("");
    setResultado("");
    setConfirmando(acao);
  }

  function botao(acao: AcaoIdoso, principal: boolean) {
    return (
      <button
        type="button"
        ref={(el) => {
          if (el) botoes.current.set(acao, el);
          else botoes.current.delete(acao);
        }}
        onClick={() => pedir(acao)}
        className={principal ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO}
      >
        {ACOES_IDOSO[acao].botao}
      </button>
    );
  }

  let corpo;
  if (!decisao.pronto) {
    corpo = <p className="text-lg text-gray-700 dark:text-gray-200">Carregando...</p>;
  } else if (!estado) {
    corpo = (
      <div className="space-y-3">
        <p role="alert" className={MENSAGEM_ERRO}>
          Não foi possível ver quem decide hoje.
        </p>
        <button type="button" onClick={() => void decisao.recarregar()} className={BOTAO_SECUNDARIO}>
          Tentar de novo
        </button>
      </div>
    );
  } else {
    const emFamilia = modoDe(estado) === "familiar";
    const pedido = estado.modo_decisao_solicitado === "familiar";
    const aprovados = vinculos.filter(
      (v) => v.papel_do_chamador === "dono" && v.tipo_vinculo === "familiar" && v.status === "aprovado",
    ).length;
    const prazo = formatarDataBR(estado.modo_decisao_expira_em);

    corpo = (
      <div className="space-y-4">
        <p className="text-lg font-semibold text-[#071A38] dark:text-white">
          {emFamilia ? "Hoje quem decide é a sua família." : "Hoje você decide."}
        </p>

        {pedido && (
          <div className="space-y-2 rounded-xl bg-[#F3F0FF] p-4 text-lg text-[#071A38] dark:bg-[#242A4A] dark:text-white">
            <p className="font-bold">Um familiar pediu para decidir por você.</p>
            {prazo && <p>Se você não cancelar, a decisão passa para a sua família em {prazo}.</p>}
            {estado.modo_decisao_motivo && <p>Motivo informado: {estado.modo_decisao_motivo}</p>}
            {aprovados >= 2 && <p>Como você tem mais de um familiar, outro familiar precisa confirmar o pedido.</p>}
            {aprovados >= 2 && (
              <p>
                {estado.modo_decisao_segunda_confirmacao_id !== null
                  ? "Já foi confirmado por outro familiar."
                  : "Ainda falta essa confirmação. Sem ela, o pedido perde a validade."}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {pedido ? (
            <>
              {botao("cancelar", true)}
              {botao("aceitar", false)}
            </>
          ) : emFamilia ? (
            botao("voltar", true)
          ) : (
            botao("passar", true)
          )}
        </div>

        {confirmando && (
          <ConfirmacaoInline
            titulo={ACOES_IDOSO[confirmando].titulo}
            texto={ACOES_IDOSO[confirmando].texto}
            rotuloConfirmar={ACOES_IDOSO[confirmando].confirmar}
            enviando={enviando}
            onConfirmar={() => enviar(confirmando)}
            onCancelar={() => {
              const origem = botoes.current.get(confirmando);
              setConfirmando(null);
              origem?.focus();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby={idTitulo} className="space-y-4">
      <h2 id={idTitulo} className="text-2xl font-bold text-[#071A38] dark:text-white">
        Quem decide por mim
      </h2>
      {corpo}
      <div role="status" className={resultado ? MENSAGEM_SUCESSO : undefined}>
        {resultado}
      </div>
      {erro && (
        <p role="alert" className={MENSAGEM_ERRO}>
          {erro}
        </p>
      )}
    </section>
  );
}

const ERROS_PEDIR: Partial<Record<number, string>> = {
  400: "Confira o motivo: no máximo 300 letras.",
  403: "Você não pode fazer este pedido.",
  404: "Vínculo não encontrado.",
  409: "Não foi possível: a decisão já está com a família, já existe um pedido em curso ou o vínculo ainda não foi aprovado.",
};
const ERROS_CONFIRMAR: Partial<Record<number, string>> = {
  400: "Não foi possível confirmar o pedido.",
  403: "Você não pode confirmar este pedido. Quem fez o pedido não confirma o próprio pedido.",
  404: "Vínculo não encontrado.",
  409: "Não há pedido de outro familiar para confirmar agora.",
};

function ModoDoFamiliar({ vinculos }: { vinculos: Vinculo[] }) {
  const idTitulo = useId();
  const idMotivo = useId();
  const [confirmando, setConfirmando] = useState<{ vinculoId: number; acao: "pedir" | "confirmar" } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState("");

  // Um item por idoso, usando o vínculo aprovado do próprio familiar (é ele que a rota exige no caminho).
  const porIdoso = new Map<number, Vinculo>();
  for (const v of vinculos) {
    if (
      v.papel_do_chamador === "vinculado" &&
      v.tipo_vinculo === "familiar" &&
      v.status === "aprovado" &&
      v.idoso.id !== null &&
      !porIdoso.has(v.idoso.id)
    ) {
      porIdoso.set(v.idoso.id, v);
    }
  }
  // O backend só mostra os vínculos do idoso ao familiar quando a decisão já está com a família.
  const jaComFamilia = new Set(vinculos.filter((v) => v.papel_do_chamador === "titular").map((v) => v.idoso.id));

  if (porIdoso.size === 0) return null;

  async function enviar(vinculoId: number, acao: "pedir" | "confirmar") {
    setEnviando(true);
    setErro("");
    setResultado("");
    const texto = motivo.trim();
    try {
      const estado = await chamarApi(
        `/vinculo/${vinculoId}/${acao === "pedir" ? "solicitar" : "confirmar"}-transferencia-decisao`,
        acao === "pedir" && texto
          ? { method: "POST", body: JSON.stringify({ modo_decisao_motivo: texto }) }
          : { method: "POST" },
      );
      setConfirmando(null);
      setMotivo("");
      if (acao === "confirmar") {
        setResultado("Pedido confirmado. Falta só o prazo de 7 dias terminar.");
      } else {
        const prazo = formatarDataBR(estado?.modo_decisao_expira_em);
        setResultado(
          prazo
            ? `Pedido enviado. A decisão passa para a família em ${prazo} se o idoso não cancelar.`
            : "Pedido enviado. O idoso pode cancelar nos próximos 7 dias.",
        );
      }
    } catch (e) {
      setConfirmando(null);
      setErro(mensagemPorStatus(e, acao === "pedir" ? ERROS_PEDIR : ERROS_CONFIRMAR));
    } finally {
      setEnviando(false);
    }
  }

  function abrir(vinculoId: number, acao: "pedir" | "confirmar") {
    setErro("");
    setResultado("");
    setMotivo("");
    setConfirmando({ vinculoId, acao });
  }

  return (
    <section aria-labelledby={idTitulo} className="space-y-4">
      <h2 id={idTitulo} className="text-2xl font-bold text-[#071A38] dark:text-white">
        Quem decide pelo idoso
      </h2>
      <p className="text-lg text-gray-700 dark:text-gray-200">
        Se o idoso precisar de ajuda para decidir, um familiar pode pedir para decidir no lugar dele. O idoso pode
        cancelar o pedido.
      </p>
      {[...porIdoso.values()].some((v) => !v.decisao) && (
        <p className="text-lg text-gray-700 dark:text-gray-200">
          Esta tela não mostra se já existe um pedido em curso.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[...porIdoso.values()].map((v) => {
          const nome = v.idoso.nome ?? "Idoso";
          const ativo = confirmando?.vinculoId === v.id ? confirmando.acao : null;
          return (
            <article
              key={v.id}
              aria-label={nome}
              className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#151B35]"
            >
              <h3 className="text-xl font-bold text-[#071A38] dark:text-white">{nome}</h3>

              <EstadoDoPedido
                nome={nome}
                decisao={v.decisao}
                jaComFamilia={jaComFamilia.has(v.idoso.id)}
                onPedir={() => abrir(v.id, "pedir")}
                onConfirmar={() => abrir(v.id, "confirmar")}
              />

              {ativo === "pedir" && (
                <ConfirmacaoInline
                  titulo={`Pedir para decidir por ${nome}?`}
                  texto="O pedido fica aberto por 7 dias e o idoso pode cancelar. Se ele não cancelar, a decisão passa para a família. Se ele tiver mais de um familiar, outro familiar precisa confirmar o pedido."
                  rotuloConfirmar="Sim, enviar pedido"
                  enviando={enviando}
                  onConfirmar={() => enviar(v.id, "pedir")}
                  onCancelar={() => setConfirmando(null)}
                >
                  <div>
                    <label htmlFor={idMotivo} className={ROTULO}>
                      Motivo (opcional)
                    </label>
                    <textarea
                      id={idMotivo}
                      rows={3}
                      maxLength={300}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className={CAMPO}
                    />
                  </div>
                </ConfirmacaoInline>
              )}
              {ativo === "confirmar" && (
                <ConfirmacaoInline
                  titulo={`Confirmar o pedido de outro familiar para ${nome}?`}
                  texto="Confirme só se você concorda. Com mais de um familiar, o pedido só vale se outro familiar também confirmar."
                  rotuloConfirmar="Sim, confirmar o pedido"
                  enviando={enviando}
                  onConfirmar={() => enviar(v.id, "confirmar")}
                  onCancelar={() => setConfirmando(null)}
                />
              )}
            </article>
          );
        })}
      </div>

      <div role="status" className={resultado ? MENSAGEM_SUCESSO : undefined}>
        {resultado}
      </div>
      {erro && (
        <p role="alert" className={MENSAGEM_ERRO}>
          {erro}
        </p>
      )}
    </section>
  );
}

type EstadoDoPedidoProps = {
  nome: string;
  decisao: DecisaoDoIdoso | null | undefined;
  jaComFamilia: boolean;
  onPedir: () => void;
  onConfirmar: () => void;
};

// O backend informa ao familiar aprovado quem decide e se há pedido em curso. Sem esse dado (resposta antiga),
// a tela volta a oferecer as duas ações e deixa o 409 explicar.
function EstadoDoPedido({ nome, decisao, jaComFamilia, onPedir, onConfirmar }: EstadoDoPedidoProps) {
  const texto = "text-lg text-gray-700 dark:text-gray-200";
  const pedir = (
    <button type="button" onClick={onPedir} className={BOTAO_PRIMARIO}>
      {`Pedir para decidir por ${nome}`}
    </button>
  );
  const confirmar = (
    <button type="button" onClick={onConfirmar} className={BOTAO_SECUNDARIO}>
      {`Confirmar o pedido de outro familiar para ${nome}`}
    </button>
  );

  if (jaComFamilia || decisao?.modo === "familiar") return <p className={texto}>A decisão já está com a família.</p>;
  if (!decisao) return <div className="flex flex-col gap-3">{pedir}{confirmar}</div>;

  const t = decisao.transferencia;
  if (!t) return pedir;

  const prazo = formatarDataBR(t.expira_em);
  const quando = prazo ? ` O prazo termina em ${prazo}.` : "";

  if (t.solicitada_por_mim) {
    return (
      <>
        <p className={texto}>{`Você pediu para decidir por ${nome}.${quando}`}</p>
        {t.exige_segunda_confirmacao && !t.segunda_confirmacao_feita && (
          <p className={texto}>Falta outro familiar confirmar o seu pedido.</p>
        )}
      </>
    );
  }

  return (
    <>
      <p className={texto}>{`Outro familiar pediu para decidir por ${nome}.${quando}`}</p>
      {t.exige_segunda_confirmacao &&
        (t.confirmada_por_mim ? (
          <p className={texto}>Você já confirmou este pedido.</p>
        ) : t.segunda_confirmacao_feita ? (
          <p className={texto}>O pedido já foi confirmado por outro familiar.</p>
        ) : (
          confirmar
        ))}
    </>
  );
}
