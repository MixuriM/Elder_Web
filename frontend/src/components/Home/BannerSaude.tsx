import { FileText } from "lucide-react";

function BannerSaude() {
  return (
    <section
      className="
        relative
        min-h-[170px]
        overflow-hidden

        rounded-2xl

        border
        border-[#6C63FF]/20

        bg-gradient-to-r
        from-[#6C63FF]
        via-[#756DFF]
        to-[#8B83FF]

        p-5

        shadow-[0_18px_38px_rgba(108,99,255,0.18)]

        transition-colors
        duration-300

        dark:border-[#4D5174]
        dark:from-[#2A2D42]
        dark:via-[#222639]
        dark:to-[#171B2B]
        dark:shadow-[0_20px_45px_rgba(2,6,23,0.45)]

        sm:p-6
      "
    >
      {/* Detalhe decorativo */}
      <div
        className="
          absolute
          -right-4
          bottom-[-45px]

          h-36
          w-36

          rotate-12

          border-l-[25px]
          border-white/15

          dark:border-[#A89FFF]/20
        "
      />

      <div
        className="
          relative

          flex
          h-full
          items-center

          gap-4

          sm:gap-5
        "
      >
        {/* Ícone */}
        <div
          className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center

            rounded-full

            bg-white/15

            text-white

            shadow-lg

            transition-colors
            duration-300

            dark:bg-[#A89FFF]
            dark:text-[#181824]

            sm:h-14
            sm:w-14
          "
        >
          <FileText size={24} />
        </div>

        {/* Textos */}
        <div>
          <p
            className="
              max-w-[560px]

              text-lg
              font-bold
              leading-snug

              text-white

              transition-colors
              duration-300

              dark:text-[#F5F5FA]

              sm:text-xl
              lg:text-[22px]
            "
          >
            Pequenas ações hoje,
            <br />
            grandes resultados amanhã!
          </p>

          <p
            className="
              mt-1

              text-xs
              text-white/80

              transition-colors
              duration-300

              dark:text-[#C7C7D1]
            "
          >
            Cuide da sua saúde. Você importa!
          </p>
        </div>
      </div>
    </section>
  );
}

export default BannerSaude;