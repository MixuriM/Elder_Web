
import SecaoOrientacao from './SecaoOrientacao'
import { secoesOrientacoes } from './dadosOrientacoes'

export default function ListaOrientacoes() {
  return (
    <>
      {secoesOrientacoes.map((secao) => (
        <SecaoOrientacao
          key={secao.id}
          id={secao.id}
          titulo={secao.titulo}
        >
          <p>{secao.texto}</p>
        </SecaoOrientacao>
      ))}
    </>
  )
}
