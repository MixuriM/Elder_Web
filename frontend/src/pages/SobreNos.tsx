import SobreCards from '../components/SobreNos/SobreCards'
import SobreCTA from '../components/SobreNos/SobreCTA'
import SobreHeader from '../components/SobreNos/SobreHeader'
import SobreHero from '../components/SobreNos/SobreHero'
import { useTitulo } from '../hooks/useTitulo'

function SobreNos() {
  useTitulo('Sobre nós')
  return (
    <main
      className="
        min-h-screen
        bg-[#F8F7FF]
        text-[#071A38]
        transition-colors
        duration-300

        dark:bg-[radial-gradient(circle_at_top,_#272A3D_0%,_#1C1E2A_30%,_#11141D_100%)]
        dark:text-[#F5F5FA]
      "
    >
      <SobreHeader />

      <div
        className="
          mx-auto
          w-full
          max-w-6xl
          px-5
          py-12

          sm:px-8
          sm:py-16

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