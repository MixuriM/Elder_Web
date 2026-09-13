import { useNavigate } from "react-router-dom";

function WelcomeBotoes() {
  const navigate = useNavigate();

  return (
    <div className="mt-9 space-y-4">

      {/* Cadastro */}
      <button
        type="button"
        onClick={() => navigate("/cadastro")}
        className="
          w-full
          rounded-2xl
          bg-[#6C63FF]
          px-6
          py-4
          text-xl
          font-bold
          text-white

          transition
          duration-200

          hover:bg-[#5B52E8]

          focus:outline-none
          focus:ring-4
          focus:ring-[#D8D4FF]

          dark:bg-[#8B82FF]
          dark:hover:bg-[#9E96FF]
          dark:focus:ring-[#3A355C]
        "
      >
        Criar minha conta
      </button>

      {/* Login */}
      <button
        type="button"
        onClick={() => navigate("/login")}
        className="
          w-full
          rounded-2xl
          border-2

          border-[#6C63FF]
          bg-white
          px-6
          py-4
          text-xl
          font-bold
          text-[#6C63FF]

          transition
          duration-200

          hover:bg-[#F3F0FF]

          focus:outline-none
          focus:ring-4
          focus:ring-[#E5E2FF]

          dark:border-[#A89FFF]
          dark:bg-[#181824]
          dark:text-[#A89FFF]

          dark:hover:bg-[#232334]

          dark:focus:ring-[#3A355C]
        "
      >
        Já tenho uma conta
      </button>

    </div>
  );
}

export default WelcomeBotoes;