// Escolha de uma opção entre poucas ("Ver como: Calendário | Lista", "Mês | Dia"): rádios nativos, com a bolinha
// marcada e a borda como sinal da escolha, além da cor.
type Props<T extends string> = {
  legenda: string
  nome: string
  opcoes: readonly { valor: T; rotulo: string }[]
  valor: T
  aoMudar: (valor: T) => void
}

export default function Alternador<T extends string>({ legenda, nome, opcoes, valor, aoMudar }: Props<T>) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <legend className="float-left mr-1 text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]">{legenda}</legend>
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#DDD9F2] bg-white px-4 py-2 text-base font-semibold text-[#071A38] hover:border-[#5F56EC] has-[:checked]:border-[#5F56EC] has-[:checked]:bg-[#F0EDFF] dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:hover:border-[#A89FFF] dark:has-[:checked]:border-[#A89FFF] dark:has-[:checked]:bg-[#29263D]"
        >
          <input
            type="radio"
            name={nome}
            value={o.valor}
            checked={valor === o.valor}
            onChange={() => aoMudar(o.valor)}
            className="h-5 w-5 shrink-0 accent-[#5F56EC] dark:accent-[#A89FFF]"
          />
          {o.rotulo}
        </label>
      ))}
    </fieldset>
  )
}
