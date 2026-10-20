
import TermosSecao from './TermosSecao'
import { LinkInterno } from '../Legal/PaginaLegal'

export default function TermosSobre() {
  return (
    <>
      {/* SOBRE O ELDER WEB */}
      <TermosSecao
        id="sobre"
        titulo="Sobre o Elder Web"
      >
        <p>
          O Elder Web é um site para apoiar pessoas idosas,
          cuidadores e familiares no dia a dia: saúde,
          remédios, agenda e alimentação. Ele foi feito
          por Marcos, Laureane e Jennifer como Trabalho
          de Conclusão de Curso do Curso Técnico em
          Desenvolvimento de Sistemas da Etec Fernando
          Prestes. É gratuito e não tem fins lucrativos.
        </p>

        <p>
          Estes Termos explicam as regras de uso. A{' '}
          <LinkInterno to="/privacidade">
            Política de Privacidade
          </LinkInterno>{' '}
          explica o que fazemos com seus dados.
        </p>
      </TermosSecao>

      {/* QUEM PODE USAR */}
      <TermosSecao
        id="quem-pode-usar"
        titulo="Quem pode usar"
      >
        <p>
          O Elder Web é para pessoas com 18 anos ou mais.
          Há três perfis: idoso, cuidador e familiar.
          Você escolhe o perfil no cadastro, e ele
          não muda depois.
        </p>
      </TermosSecao>
    </>
  )
}
