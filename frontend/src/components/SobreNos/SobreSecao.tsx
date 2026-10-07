type SobreSecaoProps = {
  id: string
  titulo: string
  texto: string
}

function SobreSecao({
  id,
  titulo,
  texto,
}: SobreSecaoProps) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-2"
    >
      <h2
        id={id}
        className="text-2xl font-bold text-[#5F56EC] dark:text-[#A18BFF]"
      >
        {titulo}
      </h2>

      <p>{texto}</p>
    </section>
  )
}

export default SobreSecao