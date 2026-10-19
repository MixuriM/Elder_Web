import {
  CalendarDays,
  FileText,
  HeartHandshake,
  HeartPulse,
  Home,
  LifeBuoy,
  Pill,
  Users,
} from "lucide-react";

import type { MenuItem } from "../components/types/home";

export const menuItems: MenuItem[] = [
  { label: "Início", to: "/Home", icon: Home },
  { label: "Meu Perfil", to: "/perfil", icon: Users },
  { label: "Saúde", to: "/saude", icon: HeartPulse },
  { label: "Medicamentos", to: "/remedios", icon: Pill },
  { label: "Agenda", to: "/agenda", icon: CalendarDays },
  { label: "Alimentação e Nutrição", to: "/alimentacao", icon: FileText },
  { label: "Família", to: "/familia", icon: Users },
  { label: "Cuidadores", to: "/cuidadores", icon: HeartHandshake },
  { label: "Orientações", to: "/orientacoes", icon: LifeBuoy },
];
