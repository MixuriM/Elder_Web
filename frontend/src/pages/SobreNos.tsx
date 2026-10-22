
import SobreCards from '../components/SobreNos/SobreCards'
import SobreCTA from '../components/SobreNos/SobreCTA'
import SobreHeader from '../components/SobreNos/SobreHeader'
import SobreHero from '../components/SobreNos/SobreHero'
import { folhaInicioD } from '../components/SobreNos/sobreNosData'
import { useTitulo } from '../hooks/useTitulo'

function SobreNos() {
  useTitulo('Sobre nós')

  return (
    <main
      className="
        relative isolate min-h-dvh
        overflow-hidden
        bg-[#F8F7FF] text-[#071A38]
        dark:bg-[#10121F] dark:text-[#F5F5FA]
      "
    >
      {/* DECORAÇÃO DO FUNDO */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-0
          -z-10 overflow-hidden
        "
      >
        {/* ILUMINAÇÃO SUPERIOR */}
        <div
          className="
            absolute -top-40 left-1/2
            h-[500px] w-[700px]
            max-w-none -translate-x-1/2
            rounded-full bg-[#E9E5FF]/60
            blur-[120px]
            dark:bg-[#6C63FF]/10
          "
        />

        {/* FOLHA SUPERIOR ESQUERDA */}
        <img
          src={folhaInicioD}
          alt=""
          className="
            absolute -left-20 top-24
            w-48 -scale-x-100
            opacity-20
            sm:-left-24 sm:w-64
            lg:-left-12 lg:w-80
            dark:opacity-25
          "
        />

        {/* FOLHA SUPERIOR DIREITA */}
        <img
          src={folhaInicioD}
          alt=""
          className="
            absolute -right-20 top-24
            w-48 rotate-[-18deg]
            opacity-20
            sm:w-64
            lg:-right-12 lg:w-80
            dark:opacity-25
          "
        />

        {/* FOLHA INFERIOR ESQUERDA */}
        <img
          src={folhaInicioD}
          alt=""
          className="
            absolute -left-24 bottom-16
            w-52 rotate-[155deg]
            opacity-15
            sm:w-72
            lg:-left-16 lg:w-80
            dark:opacity-20
          "
        />

        {/* FOLHA INFERIOR DIREITA - REFLEXO DA ESQUERDA */}
        <div
          className="
            absolute -right-24 bottom-16
            w-52 -scale-x-100
            opacity-15
            sm:w-72
            lg:-right-16 lg:w-80
            dark:opacity-20
          "
        >
          <img
            src={folhaInicioD}
            alt=""
            className="
              block w-full
              rotate-[155deg]
            "
          />
        </div>

        {/* ILUMINAÇÃO INFERIOR */}
        <div
          className="
            absolute -bottom-40 -right-40
            h-[500px] w-[500px]
            rounded-full bg-[#E5E0FF]/50
            blur-[120px]
            dark:bg-[#6C63FF]/10
          "
        />
      </div>

      {/* CABEÇALHO */}
      <SobreHeader />

      {/* CONTEÚDO PRINCIPAL */}
      <div
        className="
          relative z-10 mx-auto
          w-full max-w-6xl
          px-5 py-12
          sm:px-8 sm:py-16
          lg:px-10
        "
      >
        <SobreHero />
        <SobreCards />
        <SobreCTA />
      </div>
    </main>
  )
}

export default SobreNos
