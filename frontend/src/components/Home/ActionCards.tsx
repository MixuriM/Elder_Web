import {
  CalendarDays,
  FileText,
  HeartPulse,
  Pill,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import ActionCard from "./ActionCard";

function ActionCards() {
  const navigate = useNavigate();

  return (
    <div
      className="
        grid
        grid-cols-1

        gap-3.5

        sm:grid-cols-2
        sm:gap-4

        xl:grid-cols-4
      "
    >
      <ActionCard
        title="Minha Saúde"
        description="Acompanhe seus registros de saúde."
        icon={HeartPulse}
        onClick={() => navigate("/saude")}
        color="
          bg-gradient-to-br
          from-emerald-500
          to-emerald-700
        "
      />

      <ActionCard
        title="Meus Medicamentos"
        description="Veja seus remédios e horários."
        icon={Pill}
        onClick={() => navigate("/remedios")}
        color="
          bg-gradient-to-br
          from-[#6C63FF]
          to-[#5149D8]
        "
      />

      <ActionCard
        title="Minha Agenda"
        description="Consulte seus compromissos."
        icon={CalendarDays}
        onClick={() => navigate("/agenda")}
        color="
          bg-gradient-to-br
          from-blue-500
          to-blue-700
        "
      />

      <ActionCard
        title="Alimentação e Nutrição"
        description="Visualize seus registros e históricos."
        icon={FileText}
        onClick={() => navigate("/alimentacao")}
        color="
          bg-gradient-to-br
          from-orange-400
          to-orange-600
        "
      />
    </div>
  );
}

export default ActionCards;