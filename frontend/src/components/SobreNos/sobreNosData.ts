
import {
  GraduationCap,
  HeartPulse,
  Pill,
  ShieldCheck,
  Users,
} from 'lucide-react'

// ==========================================
// FOTOGRAFIAS DA EQUIPE
// ==========================================

import fotoMarcos from '../../Img/marcos.png'
import fotoLaureane from '../../Img/laureane.png'
import fotoJennifer from '../../Img/jennifer.png'
import fotoEquipe from '../../Img/equipe_elder.png'

// ==========================================
// IMAGEM DECORATIVA DO ELDER WEB
// ==========================================

import folhaInicioD from '../../Img/folha_inicioD.webp'

// Disponibiliza as imagens para outros componentes
export { folhaInicioD, fotoEquipe }

// ==========================================
// SEÇÕES SOBRE O ELDER WEB
// ==========================================

export const secoes = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Elder Web',
    texto:
      'O Elder Web é uma aplicação web acessível, criada para ajudar pessoas idosas, familiares e cuidadores a organizar informações importantes sobre saúde e rotina. O nome "Elder", em inglês, significa "idoso".',
    icone: HeartPulse,
  },
  {
    id: 'para-quem',
    titulo: 'Para quem é',
    texto:
      'O Elder Web foi desenvolvido pensando em três perfis: idosos, familiares e cuidadores. Cada perfil possui uma experiência adaptada às suas necessidades, facilitando a organização e o compartilhamento de informações conforme as permissões disponíveis.',
    icone: Users,
  },
  {
    id: 'o-que-reune',
    titulo: 'O que reúne',
    texto:
      'A plataforma reúne registros de saúde, organização de medicamentos com histórico e exportação em PDF, agenda de compromissos, acompanhamento da alimentação e vínculos entre idosos, familiares e cuidadores.',
    icone: Pill,
  },
  {
    id: 'acessibilidade',
    titulo: 'Nosso compromisso com a acessibilidade',
    texto:
      'A acessibilidade é uma prioridade do Elder Web. Buscamos oferecer uma navegação simples e intuitiva, com textos claros, fontes legíveis, contraste adequado, botões acessíveis e opções de visualização nos modos claro e escuro.',
    icone: ShieldCheck,
  },
  {
    id: 'quem-fez',
    titulo: 'Quem fez',
    texto:
      'O Elder Web nasceu como Trabalho de Conclusão de Curso (TCC) do Curso Técnico em Desenvolvimento de Sistemas da Etec Fernando Prestes, em 2026. Desenvolvido por Marcos, Laureane e Jennifer, o projeto une tecnologia e cuidado para facilitar a organização da rotina de pessoas idosas e de suas redes de apoio.',
    icone: GraduationCap,
  },
]

// ==========================================
// EQUIPE DE DESENVOLVIMENTO
// ==========================================

export const equipe = [
  {
    id: 'marcos',
    nome: 'Marcos',
    cargo: 'Desenvolvedor',
    foto: fotoMarcos,
    descricao:
      'Desenvolvimento do Elder Web.',
  },
  {
    id: 'laureane',
    nome: 'Laureane',
    cargo: 'Desenvolvedora',
    foto: fotoLaureane,
    descricao:
      'Desenvolvimento do Elder Web.',
  },
  {
    id: 'jennifer',
    nome: 'Jennifer',
    cargo: 'Desenvolvedora',
    foto: fotoJennifer,
    descricao:
      'Desenvolvimento do Elder Web.',
  },
]

// ==========================================
// FOTO COLETIVA DA EQUIPE
// ==========================================

export const equipeColetiva = {
  id: 'equipe-elder',
  titulo: 'Nossa equipe',
  foto: fotoEquipe,
  descricao:
    'Fotografia da equipe de desenvolvimento do Elder Web, formada por Marcos, Laureane e Jennifer, na Etec Fernando Prestes em 2026.',
}
