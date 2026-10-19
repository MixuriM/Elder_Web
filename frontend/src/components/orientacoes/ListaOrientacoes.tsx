
import SecaoOrientacao from './SecaoOrientacao'
import { secoesOrientacoes } from './dadosOrientacoes'
import { gradeOrientacoes } from './estilosOrientacoes'

export default function ListaOrientacoes() {
  return (
    <div
      className={gradeOrientacoes}
      aria-label="Lista de orientações do Elder Web"
    >
      {secoesOrientacoes.map((secao, index) => (
        <SecaoOrientacao
          key={secao.id}
          id={secao.id}
          titulo={secao.titulo}
          icone={secao.icone}
          numero={index + 1}
        >
          <p>{secao.texto}</p>
        </SecaoOrientacao>
      ))}
    </div>
  )
}
