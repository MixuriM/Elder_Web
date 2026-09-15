// Indicador de carregamento: anel com gradiente cônico (some no início,
// fica sólido no fim) mascarado em forma de anel oco. O degradê deixa a
// rotação bem visível — ao contrário de um anel de cor única, que parece
// parado mesmo girando.
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="
        inline-block
        h-8
        w-8

        animate-spin
        rounded-full

        bg-[conic-gradient(from_0deg,transparent_0%,currentColor_100%)]

        [mask-image:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-3px))]
        [-webkit-mask-image:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-3px))]
      "
    />
  );
}

export default Spinner;
