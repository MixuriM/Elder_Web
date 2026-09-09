// Componente responsável pelo lado informativo da página de cadastro

function LadoInformativo() {
  return (
    <section
      className="
        relative hidden overflow-hidden
        bg-[#F3F0FF]
        px-12 pt-12 pb-10
        lg:flex lg:flex-col lg:justify-start
      "
    >
      {/* Detalhe roxo no canto superior esquerdo */}
      <div
        className="
          pointer-events-none
          absolute -top-24 -left-24
          h-64 w-64
          rounded-full
          bg-[#DDD7FF]/60
        "
      />

      {/* Detalhe roxo no canto inferior direito */}
      <div
        className="
          pointer-events-none
          absolute -right-32 -bottom-32
          h-80 w-80
          rounded-full
          bg-[#E0DBFF]/70
        "
      />

      {/* Folha decorativa */}
      <img
        src="./src/img/flor_cadastro.svg"
        alt=""
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -bottom-12 -right-10
          w-80
          opacity-30
        "
      />

      {/* Conteúdo principal */}
      <div
        className="
          relative z-10
          w-full max-w-2xl
          font-['Atkinson_Hyperlegible']
        "
      >
        {/* Logo da plataforma */}
        <div className="flex w-full justify-center">
          <img
            src="./src/img/Elder_logo.svg"
            alt="Logo da plataforma Elder"
            className="h-auto w-60"
          />
        </div>

        {/* Mensagem principal */}
        <h1
          className="
            mt-10
            max-w-none
            text-4xl
            font-bold
            leading-[1.15]
            text-[#111827]
          "
        >
          Mais autonomia para um

          <span className="block">
            amanhã{" "}
            <span className="text-[#6C63FF]">
              mais tranquilo.
            </span>
          </span>
        </h1>

        {/* Descrição da plataforma */}
        <p
          className="
            mt-6
            max-w-xl
            text-2xl
            leading-8
            text-[#4B5563]
          "
        >
          Uma plataforma simples para ajudar você a cuidar da sua saúde e bem-estar, com recursos que facilitam o seu dia a dia.
        </p>
      </div>
    </section>
  );
}

export default LadoInformativo;