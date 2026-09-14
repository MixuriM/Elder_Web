import type { ElementType } from "react";

export type MenuItem = {
  label: string;
  icon: ElementType;
};

export type Theme = "light" | "dark" | "system";

export type ActionCardProps = {
  title: string;
  description: string;
  icon: ElementType;
  color: string;
};