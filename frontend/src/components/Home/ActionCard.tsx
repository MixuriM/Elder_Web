import { ChevronRight } from "lucide-react";

import type { ActionCardProps } from "../types/home";

function ActionCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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

        border
        border-white/10

        p-5

        text-left

        shadow-[0_18px_40px_rgba(15,23,42,0.12)]

        ring-1
        ring-black/5

        transition-all
        duration-300

        hover:-translate-y-1

        hover:shadow-[0_22px_48px_rgba(15,23,42,0.18)]

        focus:outline-none
        focus:ring-2
        focus:ring-[#6C63FF]/60

        dark:border-white/10
        dark:bg-[#1F2130]/70
        dark:shadow-[0_22px_55px_rgba(2,6,23,0.55)]
        dark:ring-white/5

        dark:hover:shadow-[0_26px_60px_rgba(2,6,23,0.6)]

        dark:focus:ring-[#A89FFF]/70

        sm:min-h-[168px]

        lg:p-6

        ${color}
      `}
    >
      <div
        className="
          absolute
          inset-0

          bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_45%)]

          opacity-80
          transition-opacity
          duration-300

          group-hover:opacity-100
        "
      />

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

      {/* Texto e seta */}
      <div className="relative flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
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

        <span
          className="
            flex
            h-9
            w-9
            shrink-0
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
          "
        >
          <ChevronRight size={17} />
        </span>
      </div>
    </button>
  );
}

export default ActionCard;