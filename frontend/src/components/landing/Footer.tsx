function Footer() {
  return (
    <footer
      className="
        border-t
        border-gray-200
        bg-white

        px-6
        py-8

        transition-colors
        duration-300

        dark:border-white/10
        dark:bg-[#0D0D16]
      "
    >
      <div
        className="
          mx-auto
          flex
          max-w-7xl
          flex-col
          items-center
          justify-between
          gap-3

          text-center

          md:flex-row
          md:text-left
        "
      >
        {/* Direitos autorais */}
        <p
          className="
            text-sm
            text-gray-500

            dark:text-gray-400
          "
        >
          © {new Date().getFullYear()} Elder Web.
          Todos os direitos reservados.
        </p>

        {/* Frase do Elder */}
        <p
          className="
            text-sm
            text-gray-500

            dark:text-gray-400
          "
        >
          Tecnologia para uma vida com mais significado.
        </p>
      </div>
    </footer>
  );
}

export default Footer;