import { useState } from "react";

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
        <button type="button" onClick={() => setEscolha(null)} className={BOTAO_SECUNDARIO}>
          Voltar
        </button>
      )}

      {escolha === "solicitar" && <SolicitarVinculo tipo={tipo} onConcluido={onConcluido} onFechar={onFechar} />}
    </div>
  );
}
