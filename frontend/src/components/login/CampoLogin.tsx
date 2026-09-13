type CampoLoginProps = {
  label: string
  type: 'email' | 'password'
  value: string

  placeholder?: string

  onChange: (valor: string) => void
}

function CampoLogin({
  label,
  type,
  value,
  placeholder,
  onChange,
}: CampoLoginProps) {
  return (
    <div>
      <label
        className="
          block
          text-lg
          font-medium
          text-gray-900
        "
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        required
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="
          mt-2
          w-full
          rounded-xl
          border
          border-gray-300
          bg-white
          px-4
          py-4
          text-lg
          text-gray-900
          outline-none
          transition
          focus:border-[#6C63FF]
          focus:ring-2
          focus:ring-[#6C63FF]/20
        "
      />
    </div>
  )
}

export default CampoLogin