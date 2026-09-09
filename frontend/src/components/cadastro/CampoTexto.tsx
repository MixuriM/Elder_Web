type CampoTextoProps = {
  id: string
  label: string
  type: string
  value: string
  onChange: (valor: string) => void
}

function CampoTexto({
  id,
  label,
  type,
  value,
  onChange
}: CampoTextoProps) {

  return (
    <div>

      <label
        htmlFor={id}
        className="block text-lg font-medium text-gray-900"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
      />

    </div>
  )
}

export default CampoTexto