// Define as propriedades que o componente CampoTexto deve receber
type CampoTextoProps = {
  id: string; // Identificador do campo
  label: string; // Texto exibido acima do campo
  type: "text" | "email" | "password"; // Tipo do input
  value: string; // Valor atual digitado
  onChange: (valor: string) => void; // Função responsável por atualizar o valor
};

// Componente reutilizável para os campos do formulário
function CampoTexto({
  id,
  label,
  type,
  value,
  onChange,
}: CampoTextoProps) {
  return (
    <div>
      {/* Exibe o nome do campo */}
      <label
        htmlFor={id}
        className="block text-lg font-medium text-gray-900"
      >
        {label}
      </label>

      {/* Campo onde o usuário digita as informações */}
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
      />
    </div>
  );
}

// Exporta o componente para ser utilizado em outros arquivos
export default CampoTexto;