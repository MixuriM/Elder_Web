import {
  CalendarDays,
  FileText,
  HeartPulse,
  Home,
  LifeBuoy,
  Pill,
  Users,
} from "lucide-react";

import type { MenuItem } from "../components/types/home";

export const menuItems: MenuItem[] = [
  { label: "Início", icon: Home },
  { label: "Meu Perfil", icon: Users },
  { label: "Saúde", icon: HeartPulse },
  { label: "Medicamentos", icon: Pill },
  { label: "Agenda", icon: CalendarDays },
  { label: "Alimentação e Nutrição", icon: FileText },
  { label: "Família", icon: Users },
  { label: "Orientações", icon: LifeBuoy },
];
