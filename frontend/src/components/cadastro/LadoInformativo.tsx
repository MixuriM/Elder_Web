// Componente responsável pelo lado informativo da página de cadastro
function LadoInformativo() {
  return (
    <section className="hidden bg-[#F3F0FF] px-12 pt-12 pb-10 lg:flex lg:flex-col lg:justify-start">
      {/* Conteúdo principal */}
      <div className="max-w-2xl font-['Atkinson_Hyperlegible']">
        
        {/* Logo da plataforma */}
        <div className="flex w-fit flex-col items-center">
          {/* Logo */}
          <img
            src="./src/img/Elder_logo.svg"
            alt="Logo da plataforma"
            className="w-40 h-auto"
          />

        </div>

        {/* Mensagem principal */}
        <h1 className="mt-10 max-w-2xl text-xl font-bold leading-[1.08] text-[#111827]">
          Mais autonomia para um amanhã
          <span className="block mt-2 text-[#6C63FF]">mais tranquilo.</span>
        </h1>

        {/* Descrição */}
        <p className="mt-6 max-w-xl text-xl leading-9 text-[#4B5563]">
          Uma plataforma simples para ajudar você a cuidar da sua saúde e manter
          contato com sua família.
        </p>

        {/* Benefícios */}
        <div className="mt-10 space-y-6">
          {/* Saúde */}
          <div className="flex items-start gap-4">
            {/* Ícone */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E9E6FF] text-2xl">
              <img
               src="./src/img/cuidados-de-saude.svg"
              alt="Ícone de saúde" 
              className="w-8 h-8" 
              />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#111827]">
                Cuidado com a saúde
              </h3>

              <p className="mt-1 text-xl leading-relaxed text-[#4B5563]">
                Acompanhe suas informações de forma simples.
              </p>
            </div>
          </div>

          {/* Conexão */}
          <div className="flex items-start gap-4">
            {/* Ícone */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E9E6FF] text-2xl">
              <img
               src="./src/img/grande-familia.png"
              alt="Ícone de conexão" 
              className="w-8 h-8" 
              />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#111827]">
                Mais conexão
              </h3>

              <p className="mt-1 text-xl leading-relaxed text-[#4B5563]">
                Fique mais próximo da sua família.
              </p>
            </div>
          </div>

          {/* Segurança */}
          <div className="flex items-start gap-4">
            {/* Ícone */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E9E6FF] text-2xl">
              🛡️
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#111827]">
                Mais segurança
              </h3>

              <p className="mt-1 text-xl leading-relaxed text-[#4B5563]">
                Seus dados sempre protegidos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LadoInformativo;
