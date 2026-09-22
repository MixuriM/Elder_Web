type CampoLoginProps = {
  id: string;
  label: string;
  type: "email" | "password";
  value: string;
  placeholder?: string;
  onChange: (valor: string) => void;
};

function CampoLogin({
  id,
  label,
  type,
  value,
  placeholder,
  onChange,
}: CampoLoginProps) {
  return (
    <div className="w-full">
      {/* Nome do campo */}
      <label
        htmlFor={id}
        className="
          block
          text-sm
          font-semibold
          text-[#344054]

          dark:text-gray-200
        "
      >
        {label}
      </label>

      {/* Campo */}
      <input
        id={id}
        type={type}
        value={value}
        required
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="
          mt-2
          w-full

          rounded-xl

          border
          border-gray-300

          bg-white

          px-4
          py-3.5

          text-base
          text-[#101828]

          outline-none

          transition
          duration-200

          placeholder:text-gray-400

          hover:border-gray-400

          focus:border-[#6C63FF]
          focus:ring-2
          focus:ring-[#6C63FF]/15

          dark:border-[#454558]
          dark:bg-[#22222F]
          dark:text-white

          dark:placeholder:text-gray-500

          dark:hover:border-[#5A5A70]

          dark:focus:border-[#8B84FF]
          dark:focus:ring-[#8B84FF]/20
        "
      />
    </div>
  );
}

export default CampoLogin;