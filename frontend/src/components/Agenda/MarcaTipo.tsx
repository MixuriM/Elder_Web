// Marca do tipo de compromisso: cor E formato (círculo, quadrado, losango), para nunca depender só da cor.
// Cores com contraste de 3:1 ou mais sobre o fundo das células, no claro e no escuro. Decorativa: o texto ao lado
// (ou o nome da célula do calendário) diz o tipo.
const FORMA: Record<string, string> = {
  pessoal: 'h-2.5 w-2.5 rounded-full bg-[#5F56EC] dark:bg-[#A89FFF]',
  medico: 'h-2.5 w-2.5 bg-[#0F766E] dark:bg-[#2DD4BF]',
  cuidado: 'm-px h-2 w-2 rotate-45 bg-[#B45309] dark:bg-[#FBBF24]',
}
const OUTRO = 'h-2.5 w-2.5 rounded-full border-2 border-[#56657D] dark:border-[#C7C7D1]'

export default function MarcaTipo({ tipo }: { tipo: string }) {
  return <span data-marca aria-hidden="true" className={`inline-block shrink-0 ${FORMA[tipo] ?? OUTRO}`} />
}

export function Legenda() {
  return (
    <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-2 text-base text-[#071A38] dark:text-[#F5F5FA]">
      {[
        ['pessoal', 'Pessoal'],
        ['medico', 'Médico'],
        ['cuidado', 'Cuidado'],
      ].map(([tipo, rotulo]) => (
        <li key={tipo} className="flex items-center gap-2">
          <MarcaTipo tipo={tipo} />
          {rotulo}
        </li>
      ))}
    </ul>
  )
}
