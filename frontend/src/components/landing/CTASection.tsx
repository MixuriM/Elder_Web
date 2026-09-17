type CTASectionProps = {
  onCriarConta: () => void;
};

function CTASection({
  onCriarConta,
}: CTASectionProps) {
  return (
    <section
      className="
        bg-[#F3F0FF]
        px-6
        py-20

        transition-colors
        duration-300

        dark:bg-[#141420]
      "
    >
      <div
        className="
          mx-auto
          max-w-5xl

          rounded-[32px]

          border
          border-[#DDD9FF]

          bg-white

          px-8
          py-14

          text-center

          shadow-sm

          dark:border-white/10
          dark:bg-[#1A1A27]
        "
      >
        <span
          className="
            text-sm
            font-bold
            uppercase
            tracking-[0.2em]

            text-[#6C63FF]

            dark:text-[#9B95FF]
          "
        >
          Cuidado que conecta
        </span>

        <h2
          className="
            mx-auto
            mt-4
            max-w-2xl

            text-3xl
            font-bold
            leading-tight

            text-[#101828]

            md:text-4xl

            dark:text-white
          "
        >
          Juntos por um futuro de mais saúde e
          bem-estar.
        </h2>

        <p
          className="
            mx-auto
            mt-5
            max-w-2xl

            text-lg
            leading-8

            text-gray-600

            dark:text-gray-300
          "
        >
          O Elder Web é mais que uma plataforma.
          É cuidado, organização e proximidade para
          hoje e para o amanhã.
        </p>

        <button
          type="button"
          onClick={onCriarConta}
          className="
            mt-8

            rounded-2xl

            bg-[#6C63FF]

            px-9
            py-4

            text-lg
            font-bold
            text-white

            transition
            duration-300

            hover:-translate-y-0.5
            hover:bg-[#5C54E8]

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6C63FF]/40

            dark:bg-[#817AFF]
            dark:hover:bg-[#6C63FF]
          "
        >
          Criar minha conta
        </button>
      </div>
    </section>
  );
}

export default CTASection;