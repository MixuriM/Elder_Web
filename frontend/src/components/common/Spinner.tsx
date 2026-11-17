// Indicador de carregamento: anel com gradiente cônico (some no início,
// fica sólido no fim) mascarado em forma de anel oco. O degradê deixa a
// rotação bem visível — ao contrário de um anel de cor única, que parece
// parado mesmo girando.
// shrink-0: dentro de um botão flex o anel não pode encolher na largura (ficava oval). `pequeno` é o tamanho de dentro de botão.
function Spinner({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`
        inline-block
        shrink-0
        ${pequeno ? 'h-5 w-5' : 'h-8 w-8'}

        animate-spin
        motion-reduce:animate-none
        rounded-full

        bg-[conic-gradient(from_0deg,transparent_0%,currentColor_100%)]

        [mask-image:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-3px))]
        [-webkit-mask-image:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-3px))]
      `}
    />
  );
}

export default Spinner;
