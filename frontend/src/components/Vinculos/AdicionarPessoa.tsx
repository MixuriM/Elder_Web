import { useState } from "react";

import CadastrarIdoso from "./CadastrarIdoso";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilosVinculo";
import type { AcaoAdicionar, TipoVinculo } from "./regrasVinculo";
import SolicitarVinculo from "./SolicitarVinculo";

type AdicionarPessoaProps = {
  tipo: TipoVinculo;
  acoes: AcaoAdicionar[];
  onConcluido: () => void;
  onFechar: () => void;
};

const ROTULOS: Record<AcaoAdicionar, string> = {
  solicitar: "Pedir vínculo com um idoso",
  cadastrar: "Cadastrar um idoso",
};

// Conteúdo do modal "Adicionar pessoa": com uma só ação abre direto o formulário; com duas, pergunta primeiro.
export default function AdicionarPessoa({ tipo, acoes, onConcluido, onFechar }: AdicionarPessoaProps) {
  const [escolha, setEscolha] = useState<AcaoAdicionar | null>(acoes.length === 1 ? acoes[0] : null);
  // Vindo do conflito de e-mail no cadastro: o pedido de vínculo já abre com o e-mail digitado.
  const [emailInicial, setEmailInicial] = useState("");

  if (escolha === null) {
    return (
      <div className="space-y-4">
        <p className="text-lg text-gray-700 dark:text-gray-200">Escolha o que deseja fazer.</p>
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            onClick={() => setEscolha(acao)}
            className={`${BOTAO_PRIMARIO} block w-full`}
          >
            {ROTULOS[acao]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {acoes.length > 1 && (
        <button
          type="button"
          onClick={() => {
            setEmailInicial("");
            setEscolha(null);
          }}
          className={BOTAO_SECUNDARIO}
        >
          Voltar
        </button>
      )}

      {escolha === "solicitar" && (
        <SolicitarVinculo
          tipo={tipo}
          emailInicial={emailInicial}
          onConcluido={onConcluido}
          onFechar={onFechar}
        />
      )}
      {escolha === "cadastrar" && (
        <CadastrarIdoso
          onConcluido={onConcluido}
          onFechar={onFechar}
          onPedirVinculo={(email) => {
            setEmailInicial(email);
            setEscolha("solicitar");
          }}
        />
      )}
    </div>
  );
}
