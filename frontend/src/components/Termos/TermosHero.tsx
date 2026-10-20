import { FileText, ShieldCheck } from 'lucide-react'

export default function TermosHero() {
  return (
    <header className="mx-auto max-w-4xl text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#B9B3FF] dark:border-white/10">
        <ShieldCheck size={17} aria-hidden="true" />
        Transparência e segurança
      </div>

      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#292640] text-[#B9B3FF]">
        <FileText size={30} aria-hidden="true" />
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight text-[#071A38] dark:text-white sm:text-5xl">
        Termos de <span className="text-[#8177FF]">Uso</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-[#C8C8D8]">
        Conheça as regras, responsabilidades e condições
        para utilizar o Elder Web com segurança e tranquilidade.
      </p>
    </header>
  )
}