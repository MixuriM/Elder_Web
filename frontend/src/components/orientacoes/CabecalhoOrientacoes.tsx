
import {
  cabecalhoOrientacoes,
  tituloPagina,
  subtituloPagina,
  florCabecalho,
  conteudoDecorado,
} from './estilosOrientacoes'

// Imagem decorativa existente no Elder Web
// Caminho considerando a pasta src/Img
import florCadastro from '../../Img/folha_inicioD.webp'

export default function CabecalhoOrientacoes() {
  return (
    <header className={cabecalhoOrientacoes}>
      {/* Flor decorativa no canto superior direito */}
      <img
        src={florCadastro}
        alt=""
        aria-hidden="true"
        className={florCabecalho}
      />

      {/* Conteúdo acima da decoração */}
      <div
        className={`${conteudoDecorado} max-w-3xl space-y-4`}
      >
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#6C63FF] dark:text-[#A18BFF]">
          Cuidado e acompanhamento
        </p>

        <h1 className={tituloPagina}>
          Orientações gerais
        </h1>

        <p className={subtituloPagina}>
          Saiba como usar o Elder Web, conheça suas
          funcionalidades e encontre ajuda sempre
          que precisar.
        </p>
      </div>
    </header>
  )
}
