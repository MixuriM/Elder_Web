
import { FileCheck2, ShieldCheck } from 'lucide-react'

export default function HeroLegal() {
  return (
    <section
      aria-labelledby="legal-titulo"
      className="
        grid items-center gap-8
        py-10 lg:grid-cols-[1.5fr_1fr]
        lg:gap-12 lg:py-14
      "
    >
      <div className="space-y-5">
        <span
          className="
            inline-flex items-center gap-2 rounded-full
            border border-[#A18BFF]/30
            bg-[#A18BFF]/10 px-4 py-2
            text-sm font-semibold text-[#5F56EC]
            dark:text-[#B6B0FF]
          "
        >
          <ShieldCheck size={18} aria-hidden="true" />
          Transparência e confiança
        </span>

        <h1
          id="legal-titulo"
          className="
            text-3xl font-extrabold tracking-tight
            text-[#071A38] sm:text-4xl lg:text-5xl
            dark:text-[#F5F5FA]
          "
        >
          Documentos Legais
        </h1>

        <p
          className="
            max-w-2xl text-base leading-8
            text-slate-600 sm:text-lg
            dark:text-[#C9C7DB]
          "
        >
          Conheça nossas políticas e entenda seus direitos,
          responsabilidades e como seus dados são tratados
          no Elder Web.
        </p>
      </div>

      <aside
        aria-label="Nosso compromisso"
        className="
          flex items-center gap-5 rounded-2xl
          border border-gray-200 bg-white/80
          p-6 dark:border-white/10
          dark:bg-[#191927]
        "
      >
        <div
          className="
            flex h-16 w-16 shrink-0 items-center
            justify-center rounded-2xl
            bg-[#EAE6FF] text-[#6258E8]
            dark:bg-[#282343] dark:text-[#A18BFF]
          "
        >
          <FileCheck2 size={30} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">
            Nosso compromisso
          </h2>

          <p className="text-sm leading-6 text-slate-600 dark:text-[#C9C7DB]">
            Clareza, segurança e respeito
            às suas informações.
          </p>
        </div>
      </aside>
    </section>
  )
}
