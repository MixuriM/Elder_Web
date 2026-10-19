
import { EMAIL_SUPORTE } from '../../lib/documentosLegais'
import SecaoOrientacao from './SecaoOrientacao'
import { link } from './estilosOrientacoes'

export default function AjudaOrientacoes() {
  return (
    <SecaoOrientacao
      id="ajuda"
      titulo="Ajuda e aviso importante"
    >
      <p>
        Para dúvidas, escreva para{' '}
        <a
          href={`mailto:${EMAIL_SUPORTE}`}
          className={link}
        >
          {EMAIL_SUPORTE}
        </a>
        , informando o seu perfil e descrevendo
        o problema, com uma captura de tela se puder.
      </p>

      <p>
        Não envie valores nem informações de saúde
        por e-mail.
      </p>

      <p>
        O Elder Web não substitui consulta nem
        orientação de profissionais de saúde.
      </p>

      <p>
        Em emergência, ligue para o SAMU, telefone{' '}
        <a
          href="tel:192"
          className="font-bold underline rounded
            focus-visible:outline
            focus-visible:outline-4
            focus-visible:outline-offset-2
            focus-visible:outline-[#071A38]
            dark:focus-visible:outline-[#F5F5FA]"
          aria-label="Ligar para o SAMU no número 192"
        >
          192
        </a>.
      </p>
    </SecaoOrientacao>
  )
}
