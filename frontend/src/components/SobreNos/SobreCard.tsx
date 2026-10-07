import type { LucideIcon } from 'lucide-react'
import { UserRound } from 'lucide-react'

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
  const quemFez = id === 'quem-fez'

  return (
    <section
      aria-labelledby={id}
      className={`
        rounded-3xl
        border
        border-[#E5E1FF]
        bg-white
        p-6
        shadow-sm
        transition-all
        duration-300

        hover:-translate-y-1
        hover:shadow-lg

        sm:p-8

        dark:border-white/10
        dark:bg-[#191B28]

        ${destaque ? 'md:col-span-2' : ''}
      `}
    >
      {/* ÍCONE */}
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-[#F0EDFF]
          text-[#6C63FF]

          dark:bg-[#6C63FF]/15
          dark:text-[#A18BFF]
        "
      >
        <Icone size={28} />
      </div>

      {/* TÍTULO */}
      <h2
        id={id}
        className="
          mt-5
          text-2xl
          font-bold
          text-[#071A38]

          dark:text-[#F5F5FA]
        "
      >
        {titulo}
      </h2>

      {/* CONTEÚDO NORMAL */}
      {!quemFez && (
        <p
          className="
            mt-3
            max-w-3xl
            text-lg
            leading-8
            text-[#56657D]

            dark:text-[#C7C7D1]
          "
        >
          {texto}
        </p>
      )}

      {/* QUEM FEZ */}
      {quemFez && (
        <div className="mt-4">
          <p
            className="
              max-w-3xl
              text-lg
              leading-8
              text-[#56657D]

              dark:text-[#C7C7D1]
            "
          >
            {texto}
          </p>

          <div
            className="
              mt-7
              grid
              grid-cols-1
              gap-4

              sm:grid-cols-3
            "
          >
            {/* MARCOS */}
            <div
              className="
                flex
                items-center
                gap-4
                rounded-2xl
                bg-[#F8F7FF]
                p-4

                dark:bg-[#11141D]
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#ECE9FF]
                  text-[#6C63FF]

                  dark:bg-[#6C63FF]/20
                  dark:text-[#A18BFF]
                "
              >
                <UserRound size={24} />
              </div>

              <div>
                <p
                  className="
                    font-bold
                    text-[#071A38]

                    dark:text-[#F5F5FA]
                  "
                >
                  Marcos
                </p>

                <p
                  className="
                    text-sm
                    text-[#56657D]

                    dark:text-[#C7C7D1]
                  "
                >
                  Desenvolvimento
                </p>
              </div>
            </div>

            {/* LAUREANE */}
            <div
              className="
                flex
                items-center
                gap-4
                rounded-2xl
                bg-[#F8F7FF]
                p-4

                dark:bg-[#11141D]
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#ECE9FF]
                  text-[#6C63FF]

                  dark:bg-[#6C63FF]/20
                  dark:text-[#A18BFF]
                "
              >
                <UserRound size={24} />
              </div>

              <div>
                <p
                  className="
                    font-bold
                    text-[#071A38]

                    dark:text-[#F5F5FA]
                  "
                >
                  Laureane
                </p>

                <p
                  className="
                    text-sm
                    text-[#56657D]

                    dark:text-[#C7C7D1]
                  "
                >
                  Desenvolvimento
                </p>
              </div>
            </div>

            {/* JENNIFER */}
            <div
              className="
                flex
                items-center
                gap-4
                rounded-2xl
                bg-[#F8F7FF]
                p-4

                dark:bg-[#11141D]
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#ECE9FF]
                  text-[#6C63FF]

                  dark:bg-[#6C63FF]/20
                  dark:text-[#A18BFF]
                "
              >
                <UserRound size={24} />
              </div>

              <div>
                <p
                  className="
                    font-bold
                    text-[#071A38]

                    dark:text-[#F5F5FA]
                  "
                >
                  Jennifer
                </p>

                <p
                  className="
                    text-sm
                    text-[#56657D]

                    dark:text-[#C7C7D1]
                  "
                >
                  Desenvolvimento
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SobreCard