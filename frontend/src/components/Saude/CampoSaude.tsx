import type { InputHTMLAttributes } from 'react'

type CampoSaudeProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
}

function CampoSaude({
  id,
  label,
  className = '',
  ...props
}: CampoSaudeProps) {
  return (
    <div className="w-full space-y-2">
      <label
        htmlFor={id}
        className="
          block
          text-base
          font-semibold
          text-[#071A38]
          dark:text-[#F5F5FA]
          sm:text-lg
        "
      >
        {label}
      </label>

      <input
        id={id}
        {...props}
        className={`
          min-h-[56px]
          w-full
          rounded-xl
          border
          border-[#D9D7E8]
          bg-white
          px-4
          py-3
          text-base
          text-[#071A38]
          outline-none
          transition-all
          duration-200

          placeholder:text-[#8B93A7]

          hover:border-[#B9B4D6]

          focus:border-[#6C63FF]
          focus:ring-2
          focus:ring-[#6C63FF]/15

          disabled:cursor-not-allowed
          disabled:bg-[#F4F4F7]
          disabled:opacity-70

          dark:border-[#3B3B49]
          dark:bg-[#171721]
          dark:text-[#F5F5FA]
          dark:placeholder:text-[#A7A7B5]

          dark:hover:border-[#555565]

          dark:focus:border-[#9B96FF]
          dark:focus:ring-[#9B96FF]/20

          dark:disabled:bg-[#20202A]

          sm:text-lg

          ${className}
        `}
      />
    </div>
  )
}

export default CampoSaude