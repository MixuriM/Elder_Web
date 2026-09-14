import { ChevronRight } from "lucide-react";

import type { ActionCardProps } from "../types/home";

function ActionCard({
  title,
  description,
  icon: Icon,
  color,
}: ActionCardProps) {
  return (
    <button
      type="button"
      className={`
        group

        relative

        flex
        min-h-[158px]
        flex-1
        flex-col
        justify-between

        overflow-hidden

        rounded-2xl

        p-5

        text-left

        shadow-lg
        shadow-black/10

        ring-1
        ring-black/5

        transition-all
        duration-300

        hover:-translate-y-1

        hover:shadow-2xl
        hover:shadow-black/15

        focus:outline-none
        focus:ring-2
        focus:ring-[#6C63FF]/60

        dark:shadow-black/25
        dark:ring-white/5

        dark:hover:shadow-black/35

        dark:focus:ring-[#A89FFF]/70

        sm:min-h-[168px]

        lg:p-6

        ${color}
      `}
    >
      {/* Detalhe decorativo */}
      <div
        className="
          absolute
          -right-7
          -top-7

          h-24
          w-24

          rounded-full

          bg-white/10

          transition-transform
          duration-300

          group-hover:scale-150
        "
      />

      {/* Ícone */}
      <Icon
        size={40}
        strokeWidth={1.8}
        className="
          relative

          text-white/95

          transition-transform
          duration-300

          group-hover:scale-110
        "
      />

      {/* Texto */}
      <div className="relative">
        <h3
          className="
            text-[17px]
            font-bold
            text-white

            sm:text-[18px]
          "
        >
          {title}
        </h3>

        <p
          className="
            mt-1

            max-w-[230px]

            text-[12px]
            leading-4

            text-white/80

            sm:text-[13px]
          "
        >
          {description}
        </p>
      </div>

      {/* Seta */}
      <span
        className="
          absolute
          bottom-4
          right-4

          flex
          h-9
          w-9
          items-center
          justify-center

          rounded-full

          bg-white

          text-[#071A38]

          shadow-md

          transition-all
          duration-300

          group-hover:translate-x-1
          group-hover:scale-105

          sm:bottom-5
          sm:right-5
        "
      >
        <ChevronRight size={17} />
      </span>
    </button>
  );
}

export default ActionCard;