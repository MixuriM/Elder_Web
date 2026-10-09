import { MailWarning } from "lucide-react";

// Texto visível e lido pelo leitor de tela; o ícone é só enfeite (a cor nunca é o único sinal).
export default function AvisoEmailPendente() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[#FFFAEB] p-3 text-base font-semibold text-[#71350B] dark:bg-[#2B2417] dark:text-[#FEDF89]">
      <MailWarning size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>O e-mail ainda não foi confirmado. Quando a pessoa confirmar, o vínculo é aprovado sozinho.</span>
    </p>
  );
}
