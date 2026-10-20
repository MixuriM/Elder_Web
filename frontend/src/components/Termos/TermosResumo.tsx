import {
  HeartHandshake,
  HeartPulse,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react'

const resumo = [
  {
    titulo: 'Cuidado organizado',
    texto:
      'O Elder Web ajuda idosos, familiares e cuidadores a organizar a saúde e a rotina.',
    icone: HeartHandshake,
  },
  {
    titulo: 'Não substitui médicos',
    texto:
      'Não realiza diagnósticos nem indica tratamentos. Em emergências, ligue 192.',
    icone: HeartPulse,
  },
  {
    titulo: 'Projeto acadêmico',
    texto:
      'É gratuito, sem fins lucrativos e pode passar por mudanças ou ficar indisponível.',
    icone: GraduationCap,
  },
  {
    titulo: 'Uso responsável',
    texto:
      'Ao criar uma conta, você declara que leu e concorda com os Termos e a Política de Privacidade.',
    icone: ShieldCheck,
  },
]

export default function TermosResumo() {
  return (
    <section
      aria-labelledby="resumo-termos"
      className="mx-auto mt-14 max-w-6xl"
    >
      <h2
        id="resumo-termos"
        className="mb-6 text-2xl font-bold text-[#071A38] dark:text-white"
      >
        Antes de começar
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {resumo.map(({ titulo, texto, icone: Icone }) => (
          <article
            key={titulo}
            className="
              rounded-2xl border border-[#E4E0F5]
              bg-white p-6
              dark:border-[#343344]
              dark:bg-[#191925]
            "
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAE6FF] text-[#6258E8] dark:bg-[#292640] dark:text-[#B9B3FF]">
              <Icone size={24} aria-hidden="true" />
            </div>

            <h3 className="mb-3 text-lg font-bold text-[#071A38] dark:text-white">
              {titulo}
            </h3>

            <p className="text-base leading-7 text-slate-600 dark:text-[#C8C8D8]">
              {texto}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}