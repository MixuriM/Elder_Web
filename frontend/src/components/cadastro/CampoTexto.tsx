import { useState } from "react";

import BotaoMostrarSenha from "../common/BotaoMostrarSenha";

// Define as propriedades que o componente CampoTexto deve receber
type CampoTextoProps = {
  id: string; // Identificador do campo
  label: string; // Texto exibido acima do campo
  type: "text" | "email" | "password"; // Tipo do input
  value: string; // Valor atual digitado
  onChange: (valor: string) => void; // Função responsável por atualizar o valor
  required?: boolean; // Se o campo é obrigatório (padrão: true)
  maxLength?: number; // Limite de caracteres
  minLength?: number; // Mínimo de caracteres
  autoComplete?: string; // Dica de preenchimento automático do navegador
  hint?: string; // Texto de ajuda exibido abaixo do campo
};

// Componente reutilizável para os campos do formulário
function CampoTexto({
  id,
  label,
  type,
  value,
  onChange,
  required = true,
  maxLength,
  minLength,
  autoComplete,
  hint,
}: CampoTextoProps) {
  // Campos de senha ganham botão para mostrar/ocultar o que foi digitado
  const [mostrar, setMostrar] = useState(false);
  const ehSenha = type === "password";
  const idHint = hint ? `${id}-hint` : undefined;

  return (
    <div>

      {/* Exibe o nome do campo */}
      <label
        htmlFor={id}
        className="
          block
          text-lg
          font-medium

          text-[#071A38]
          dark:text-[#F5F5FA]

          transition-colors
          duration-300
        "
      >
        {label}
      </label>

      <div className="relative">
        {/* Campo onde o usuário digita as informações */}
        <input
          id={id}
          type={ehSenha && mostrar ? "text" : type}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={autoComplete}
          aria-describedby={idHint}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            mt-1
            w-full
            rounded-xl
            border

            border-gray-300
            bg-white
            text-[#071A38]

            px-4
            py-3
            text-lg
            ${ehSenha ? "pr-14" : ""}

            outline-none
            transition-colors
            duration-300

            placeholder:text-gray-400

            hover:border-gray-400

            focus:border-[#6C63FF]
            focus:ring-2
            focus:ring-[#6C63FF]/20

            dark:border-[#454558]
            dark:bg-[#181824]
            dark:text-[#F5F5FA]
            dark:placeholder:text-[#858594]

            dark:hover:border-[#66667A]

            dark:focus:border-[#A89FFF]
            dark:focus:ring-[#A89FFF]/20
          `}
        />

        {ehSenha && (
          <BotaoMostrarSenha
            mostrar={mostrar}
            onToggle={() => setMostrar((atual) => !atual)}
            campo={label.toLowerCase()}
          />
        )}
      </div>

      {hint && (
        <p
          id={idHint}
          className="
            mt-1
            text-base
            text-[#4B5563]
            dark:text-[#B9B9C5]
          "
        >
          {hint}
        </p>
      )}

    </div>
  );
}

// Exporta o componente para ser utilizado em outros arquivos
export default CampoTexto;
