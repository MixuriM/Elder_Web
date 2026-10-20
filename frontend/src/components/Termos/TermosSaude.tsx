
import TermosSecao from './TermosSecao'

export default function TermosSaude() {
  return (
    <>
      {/* SAÚDE: AVISO IMPORTANTE */}
      <TermosSecao
        id="saude"
        titulo="Saúde: aviso importante"
      >
        <p>
          O Elder Web organiza informações que as pessoas
          registram. Ele não faz diagnóstico, não aconselha
          tratamento e não substitui médico, enfermeiro
          ou farmacêutico. Antes de mudar um remédio ou
          um tratamento, fale com um profissional de saúde.
        </p>

        <p>
          <strong>
            Em emergência, ligue para o SAMU, telefone 192.
          </strong>
        </p>
      </TermosSecao>

      {/* AVISO DE EMERGÊNCIA */}
      <TermosSecao
        id="emergencia"
        titulo="Aviso de emergência"
      >
        <p>
          O botão de ajuda, que aparece para o perfil de
          idoso, envia um e-mail para as pessoas com vínculo
          aprovado que confirmaram o e-mail. Há um limite
          de envios por hora.
        </p>

        <p>
          O aviso depende da internet, do serviço de e-mail
          e de alguém ler a mensagem. O e-mail pode atrasar,
          cair na caixa de spam ou não chegar. Por isso,
          o aviso não substitui ligar 192: em perigo,
          ligue 192 primeiro.
        </p>
      </TermosSecao>
    </>
  )
}
