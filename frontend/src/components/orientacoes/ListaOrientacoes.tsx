
import SecaoOrientacao from './SecaoOrientacao'
import { secoesOrientacoes } from './dadosOrientacoes'
import { gradeOrientacoes } from './estilosOrientacoes'

export default function ListaOrientacoes() {
  return (
    <ul
      className={gradeOrientacoes}
      aria-label="Lista de orientações do Elder Web"
    >
      {secoesOrientacoes.map((secao, index) => (
        <li key={secao.id} className="grid min-w-0">
          <SecaoOrientacao
            id={secao.id}
            titulo={secao.titulo}
            icone={secao.icone}
            numero={index + 1}
          >
            <p>{secao.texto}</p>
          </SecaoOrientacao>
        </li>
      ))}
    </ul>
  )
}
