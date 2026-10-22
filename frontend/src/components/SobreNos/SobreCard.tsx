
import type { LucideIcon } from 'lucide-react'
import { UserRound, UsersRound } from 'lucide-react'
import { equipe, equipeColetiva } from './sobreNosData'

type SobreCardProps = {
  id: string
  titulo: string
  texto: string
  icone: LucideIcon
  destaque?: boolean
}

function SobreCard({
  id,
  titulo,
  texto,
  icone: Icone,
  destaque = false,
}: SobreCardProps) {
  const mostrarEquipe = id === 'quem-fez'

  return (
    <section
      aria-labelledby={`titulo-${id}`}
      className={`
        relative min-w-0
        rounded-2xl
        border border-[#E6E2F5]
        bg-white/90
        p-5 sm:p-8
        dark:border-[#303149]
        dark:bg-[#191B2A]/95
        ${destaque ? 'md:col-span-2' : ''}
      `}
    >
      {/* CABEÇALHO */}
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="
            flex h-12 w-12 shrink-0
            items-center justify-center
            rounded-xl
            bg-[#EAE6FF] text-[#6258E8]
            dark:bg-[#292641]
            dark:text-[#B9B3FF]
          "
        >
          <Icone size={25} strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id={`titulo-${id}`}
            className="
              break-words text-xl font-bold
              leading-snug text-[#071A38]
              sm:text-2xl
              dark:text-[#F5F5FA]
            "
          >
            {titulo}
          </h2>

          <div
            aria-hidden="true"
            className="
              mt-3 h-1 w-12 rounded-full
              bg-[#6C63FF]
              dark:bg-[#A18BFF]
            "
          />
        </div>
      </div>

      {/* DESCRIÇÃO DA SEÇÃO */}
      <p
        className="
          mt-5 text-base leading-8
          text-[#46536B]
          dark:text-[#C7C7D1]
        "
      >
        {texto}
      </p>

      {/* EQUIPE DE DESENVOLVIMENTO */}
      {mostrarEquipe && (
        <div className="mt-10">

          {/* TÍTULO DA EQUIPE */}
          <div className="mb-7 text-center">
            <p
              className="
                text-xs font-bold uppercase
                tracking-[0.18em]
                text-[#6258E8]
                dark:text-[#B9B3FF]
              "
            >
              Nossa equipe
            </p>

            <h3
              className="
                mt-2 text-2xl font-bold
                tracking-tight text-[#071A38]
                sm:text-3xl
                dark:text-[#F5F5FA]
              "
            >
              Quem está por trás do Elder Web?
            </h3>
          </div>

          {/* CARTÕES INDIVIDUAIS */}
          <div
            className="
              grid grid-cols-1 gap-5
              sm:grid-cols-2
              lg:grid-cols-3
            "
          >
            {equipe.map((integrante) => (
              <article
                key={integrante.id}
                className="
                  flex min-w-0 flex-col
                  overflow-hidden rounded-2xl
                  border border-[#E9E5F5]
                  bg-[#F8F7FF]
                  p-4
                  dark:border-[#303149]
                  dark:bg-[#11141D]
                "
              >
                {/* FOTOGRAFIA */}
                <div
                  className="
                    mx-auto aspect-[4/5]
                    w-full max-w-[280px]
                    overflow-hidden rounded-xl
                    bg-[#EAE6FF]
                    dark:bg-[#25243B]
                  "
                >
                  {integrante.foto ? (
                    <img
                      src={integrante.foto}
                      alt={`Foto de ${integrante.nome}`}
                      loading="lazy"
                      decoding="async"
                      className="
                        block h-full w-full
                        object-cover object-center
                      "
                    />
                  ) : (
                    <div
                      role="img"
                      aria-label={`Fotografia de ${integrante.nome} indisponível`}
                      className="
                        flex h-full w-full
                        items-center justify-center
                        text-[#6258E8]
                        dark:text-[#B9B3FF]
                      "
                    >
                      <UserRound
                        size={64}
                        strokeWidth={1.4}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>

                {/* INFORMAÇÕES */}
                <div
                  className="
                    flex flex-1 flex-col
                    items-center pt-5
                    text-center
                  "
                >
                  <h4
                    className="
                      text-xl font-bold
                      text-[#071A38]
                      dark:text-[#F5F5FA]
                    "
                  >
                    {integrante.nome}
                  </h4>

                  <p
                    className="
                      mt-1 text-sm font-semibold
                      text-[#5147B5]
                      dark:text-[#B9B3FF]
                    "
                  >
                    {integrante.cargo}
                  </p>

                  <div
                    aria-hidden="true"
                    className="
                      my-4 h-px w-12
                      bg-[#DCD6FF]
                      dark:bg-[#49446F]
                    "
                  />

                  <p
                    className="
                      max-w-[260px]
                      text-sm leading-6
                      text-[#46536B]
                      dark:text-[#C7C7D1]
                    "
                  >
                    {integrante.descricao}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* FOTOGRAFIA COLETIVA */}
          <div className="mt-12">
            <div
              className="
                mb-5 flex items-center
                justify-center gap-3
              "
            >
              <UsersRound
                size={22}
                aria-hidden="true"
                className="
                  text-[#6258E8]
                  dark:text-[#B9B3FF]
                "
              />

              <h3
                className="
                  text-xl font-bold
                  text-[#071A38]
                  dark:text-[#F5F5FA]
                "
              >
                Juntos pelo cuidado
              </h3>
            </div>

            <figure
              className="
                mx-auto w-full
                max-w-3xl
              "
            >
              <div
                className="
                  overflow-hidden rounded-2xl
                  border border-[#E6E2F5]
                  bg-[#F8F7FF]
                  p-2
                  dark:border-[#303149]
                  dark:bg-[#11141D]
                "
              >
                <img
                  src={equipeColetiva.foto}
                  alt={equipeColetiva.descricao}
                  loading="lazy"
                  decoding="async"
                  className="
                    block h-auto w-full
                    rounded-xl
                  "
                />
              </div>

              <figcaption
                className="
                  mt-4 text-center
                  text-sm leading-6
                  text-[#46536B]
                  dark:text-[#C7C7D1]
                "
              >
                Equipe Elder Web — Etec Fernando Prestes, 2026.
              </figcaption>
            </figure>
          </div>
        </div>
      )}
    </section>
  )
}

export default SobreCard
