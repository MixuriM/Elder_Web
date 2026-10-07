import {
  GraduationCap,
  HeartPulse,
  Pill,
  ShieldCheck,
  Users,
} from 'lucide-react'

export const secoes = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Elder Web',
    texto:
      'O Elder Web é uma aplicação web que apoia idosos, cuidadores e familiares no gerenciamento de saúde e rotina diária. "Elder", em inglês, significa "idoso".',
    icone: HeartPulse,
  },
  {
    id: 'para-quem',
    titulo: 'Para quem é',
    texto:
      'Para o idoso, o cuidador e o familiar. Cada pessoa tem uma conta com o seu perfil.',
    icone: Users,
  },
  {
    id: 'o-que-reune',
    titulo: 'O que reúne',
    texto:
      'Registro de saúde. Remédios com histórico e exportação em PDF. Agenda de compromissos. Registro de alimentação. Vínculos entre idosos e seus cuidadores e familiares.',
    icone: Pill,
  },
  {
    id: 'acessibilidade',
    titulo: 'Nosso compromisso com a acessibilidade',
    texto:
      'Buscamos letras grandes, bom contraste, botões fáceis de tocar e textos simples.',
    icone: ShieldCheck,
  },
  {
    id: 'quem-fez',
    titulo: 'Quem fez',
    texto:
      'O Elder Web foi desenvolvido como Projeto de Conclusão de Curso (TCC) do Curso Técnico em Desenvolvimento de Sistemas da Etec Fernando Prestes, em 2026. O projeto foi desenvolvido pela equipe formada por Marcos, Laureane e Jennifer.',
    icone: GraduationCap,
  },
]