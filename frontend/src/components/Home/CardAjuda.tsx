import {
  ChevronRight,
  LifeBuoy,
} from "lucide-react";

function CardAjuda() {
  return (
    <section
      className="
        rounded-2xl

        border
        border-gray-200

        bg-white

        p-5

        shadow-lg
        shadow-black/5

        transition-colors
        duration-300

        dark:border-[#454558]
        dark:bg-[#2B2C3B]
        dark:shadow-black/20

        sm:p-6
      "
    >
      <div className="flex items-start gap-3">

        {/* Ícone */}
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center

            rounded-full

            bg-[#6C63FF]

            text-white

            transition-colors
            duration-300

            dark:bg-[#A89FFF]
            dark:text-[#181824]
          "
        >
          <LifeBuoy size={20} />
        </div>

        {/* Texto */}
        <div>
          <h3
            className="
              text-sm
              font-bold

              text-[#071A38]

              transition-colors
              duration-300

              dark:text-[#F5F5FA]
            "
          >
            Precisa de ajuda?
          </h3>

          <p
            className="
              mt-1

              text-[11px]
              leading-4

              text-gray-500

              transition-colors
              duration-300

              dark:text-[#C7C7D1]
            "
          >
            Veja nossas orientações
            <br />
            ou fale com sua família.
          </p>
        </div>
      </div>

      {/* Botão */}
      <button
        type="button"
        className="
          mt-5

          flex
          h-11
          w-full
          items-center
          justify-center
          gap-2

          rounded-xl

          bg-[#6C63FF]

          text-xs
          font-semibold
          text-white

          shadow-lg
          shadow-[#6C63FF]/20

          transition-all
          duration-300

          hover:-translate-y-0.5
          hover:bg-[#5B53E8]

          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-[#6C63FF]/30

          dark:bg-[#A89FFF]
          dark:text-[#181824]
          dark:hover:bg-[#B8B1FF]
          dark:focus-visible:ring-[#A89FFF]/30
        "
      >
        Ver orientações
        <ChevronRight size={15} />
      </button>
    </section>
  );
}

export default CardAjuda;