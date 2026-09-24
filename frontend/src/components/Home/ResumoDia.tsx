import {
  CalendarDays,
  HeartPulse,
  Pill,
} from "lucide-react";

function ResumoDia() {
  const cardClass = `
    group

    rounded-2xl

    border
    border-gray-200

    bg-white

    p-4

    shadow-[0_12px_30px_rgba(15,23,42,0.04)]

    cursor-pointer

    transition-all
    duration-300
    ease-out

    hover:-translate-y-1

    hover:border-[#6C63FF]/40
    hover:bg-[#F8F7FF]

    hover:shadow-[0_18px_38px_rgba(108,99,255,0.12)]

    dark:border-[#454A63]
    dark:bg-[#1F2130]

    dark:hover:border-[#A89FFF]/50
    dark:hover:bg-[#262A3B]

    dark:hover:shadow-[0_18px_40px_rgba(2,6,23,0.5)]

    sm:p-5
  `;

  const labelClass = `
    text-xs

    text-gray-500

    transition-colors
    duration-300

    group-hover:text-[#071A38]

    dark:text-[#C7C7D1]
    dark:group-hover:text-[#F5F5FA]
  `;

  return (
    <div className="mt-6 sm:mt-8">

      {/* Título */}
      <h3
        className="
          mb-3

          text-sm
          font-semibold

          text-[#071A38]

          transition-colors
          duration-300

          dark:text-[#F5F5FA]
        "
      >
        Resumo do seu dia
      </h3>

      <div className="grid gap-3 sm:grid-cols-3">

        {/* Medicamentos */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>
              Medicamentos hoje
            </span>

            <Pill
              size={17}
              className="
                text-[#6C63FF]

                transition-transform
                duration-300

                group-hover:scale-125

                dark:text-[#A89FFF]
              "
            />
          </div>

          <p
            className="
              mt-2

              text-2xl
              font-bold

              text-[#071A38]

              transition-colors
              duration-300

              dark:text-[#F5F5FA]
            "
          ></p>

          <p
            className="
              text-[10px]
              text-emerald-500
            "
          ></p>
        </div>

        {/* Compromissos */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>
              Compromissos
            </span>

            <CalendarDays
              size={17}
              className="
                text-blue-500

                transition-transform
                duration-300

                group-hover:scale-125

                dark:text-blue-400
              "
            />
          </div>

          <p
            className="
              mt-2

              text-2xl
              font-bold

              text-[#071A38]

              transition-colors
              duration-300

              dark:text-[#F5F5FA]
            "
          ></p>

          <p
            className="
              text-[10px]

              text-gray-500

              transition-colors
              duration-300

              dark:text-[#C7C7D1]
            "
          ></p>
        </div>

        {/* Saúde */}
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>
              Saúde
            </span>

            <HeartPulse
              size={17}
              className="
                text-emerald-500

                transition-transform
                duration-300

                group-hover:scale-125

                dark:text-emerald-400
              "
            />
          </div>

          <p
            className="
              mt-2

              text-2xl
              font-bold

              text-[#071A38]

              transition-colors
              duration-300

              dark:text-[#F5F5FA]
            "
          ></p>

          <p
            className="
              text-[10px]
              text-emerald-500
            "
          ></p>
        </div>
      </div>
    </div>
  );
}

export default ResumoDia;