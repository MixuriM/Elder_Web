// Conteúdo provisório (item 8.2, RF-031). Texto final e layout: Laureane e Jennifer.
import { Link } from 'react-router-dom'

const foco =
  'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#071A38] dark:focus-visible:outline-[#F5F5FA]'
const link = `inline-flex min-h-[44px] items-center rounded-lg border-2 border-[#6C63FF] bg-[#F3F0FF] px-4 text-lg font-semibold text-[#071A38] underline dark:bg-[#151522] dark:text-[#F5F5FA] ${foco}`

const EMAIL_SUPORTE = 'elder.web.suporte@gmail.com'

const secoes = [
  {
    id: 'como-comecar',
    titulo: 'Como começar',
    texto:
      'O acesso é por e-mail e senha ou por conta Google. Depois do cadastro, confirme o e-mail que o sistema envia. O que você pode fazer depende do seu perfil: idoso, cuidador ou familiar.',
  },
  {
    id: 'senha-e-acesso',
    titulo: 'Senha e acesso',
    texto:
      'Se esquecer a senha, use "Esqueci minha senha" na tela de entrada. O primeiro acesso depois de um tempo sem uso pode demorar alguns instantes.',
  },
  {
    id: 'perfis-e-vinculos',
    titulo: 'Perfis e vínculos',
    texto:
      'O cuidador só usa as ferramentas de cuidador depois de ter um vínculo aprovado com um idoso. Os vínculos são gerenciados na área de vínculos.',
  },
  {
    id: 'o-que-encontra',
    titulo: 'O que você encontra no Elder Web',
    texto:
      'Saúde (registro e consulta). Remédios, com histórico e exportação em PDF. Agenda de compromissos. Alimentação.',
  },
]

export default function Orientacoes() {
  return (
    <div className="min-h-screen bg-white text-lg text-[#071A38] dark:bg-[#101018] dark:text-[#F5F5FA]">
      <header className="flex flex-wrap gap-4 border-b-2 border-[#6C63FF] p-4">
        <Link to="/Home" className={link}>
          Voltar para o início
        </Link>
        <Link to="/perfil" className={link}>
          Meu perfil
        </Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 p-4">
        <h1 className="text-4xl font-bold text-[#6C63FF] dark:text-[#A18BFF]">Orientações gerais</h1>
        {secoes.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="space-y-2">
            <h2 id={s.id} className="text-2xl font-bold text-[#6C63FF] dark:text-[#A18BFF]">
              {s.titulo}
            </h2>
            <p>{s.texto}</p>
          </section>
        ))}
        <section aria-labelledby="ajuda" className="space-y-2">
          <h2 id="ajuda" className="text-2xl font-bold text-[#6C63FF] dark:text-[#A18BFF]">
            Ajuda e aviso importante
          </h2>
          <p>
            Para dúvidas, escreva para{' '}
            <a href={`mailto:${EMAIL_SUPORTE}`} className={link}>
              {EMAIL_SUPORTE}
            </a>
            , informando o seu perfil e descrevendo o problema, com uma captura de tela se puder.
          </p>
          <p>Não envie valores nem informações de saúde por e-mail.</p>
          <p>O Elder Web não substitui consulta nem orientação de profissionais de saúde.</p>
          <p>Em emergência, ligue para o SAMU, telefone 192.</p>
        </section>
      </main>
    </div>
  )
}
