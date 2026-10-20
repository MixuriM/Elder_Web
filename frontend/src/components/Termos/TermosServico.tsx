
import TermosSecao from './TermosSecao'

export default function TermosServico() {
  return (
    <>
      {/* DISPONIBILIDADE E MUDANÇAS NO SERVIÇO */}
      <TermosSecao
        id="disponibilidade"
        titulo="Disponibilidade e mudanças no serviço"
      >
        <p>
          O Elder Web roda em hospedagem gratuita.
          Ele pode demorar a responder no primeiro acesso,
          ficar fora do ar ou ter falhas.
          Não garantimos um tempo mínimo no ar.
        </p>

        <p>
          O projeto pode mudar ou ser encerrado.
          Quando possível, vamos avisar com pelo menos
          30 dias de antecedência, para você baixar
          o histórico em PDF antes.
        </p>
      </TermosSecao>

      {/* RESPONSABILIDADES */}
      <TermosSecao
        id="responsabilidades"
        titulo="Responsabilidades"
      >
        <p>
          Fazemos o possível para o Elder Web funcionar bem,
          mas ele é um projeto acadêmico em desenvolvimento.
          Respondemos pelo que fazemos na medida da lei.
          Nada nestes Termos tira direitos que o Código
          de Defesa do Consumidor ou outra lei garantem a você.
        </p>

        <p>
          Você responde pelo que registra e pelo uso da sua conta.
        </p>
      </TermosSecao>

      {/* PROPRIEDADE INTELECTUAL */}
      <TermosSecao
        id="propriedade"
        titulo="Propriedade intelectual"
      >
        <p>
          O código, o nome Elder Web e a marca são dos
          autores do projeto. Os dados que você cadastra
          continuam sendo seus, ou da pessoa a quem
          se referem. Usamos esses dados só como
          explica a Política de Privacidade.
        </p>
      </TermosSecao>
    </>
  )
}
