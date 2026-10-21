
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

import fotoMarcos from '../../Img/Marc.jpeg'
import fotoLaureane from '../../Img/Lau.jpeg'
import fotoJennifer from '../../Img/Jen.jpeg'

// ==========================================
// IMAGEM DECORATIVA DO ELDER WEB
// ==========================================

import folhaInicioD from '../../Img/folha_inicioD.webp'

// Disponibiliza a folha para outros componentes
export { folhaInicioD }

// ==========================================
// SEÇÕES SOBRE O ELDER WEB
// ==========================================

export const secoes = [
  {
    id: 'o-que-e',
    titulo: 'O que é o Elder Web',
    texto:
      'O Elder Web é uma aplicação web acessível, desenvolvida para apoiar idosos, familiares e cuidadores na organização da saúde e da rotina diária. O nome "Elder", em inglês, significa "idoso".',
    icone: HeartPulse,
  },
  {
    id: 'para-quem',
    titulo: 'Para quem é',
    texto:
      'O Elder Web foi pensado para idosos, cuidadores e familiares. Cada usuário possui seu próprio perfil, permitindo uma experiência organizada e adequada às suas necessidades.',
    icone: Users,
  },
  {
    id: 'o-que-reune',
    titulo: 'O que reúne',
    texto:
      'A plataforma reúne funcionalidades como registros de saúde, controle de medicamentos com histórico e exportação em PDF, agenda de compromissos, acompanhamento da alimentação e vínculos entre idosos, familiares e cuidadores.',
    icone: Pill,
  },
  {
    id: 'acessibilidade',
    titulo: 'Nosso compromisso com a acessibilidade',
    texto:
      'A acessibilidade é uma prioridade do Elder Web. Buscamos oferecer textos claros, fontes legíveis, bom contraste, botões de fácil utilização, navegação intuitiva e suporte aos modos claro e escuro.',
    icone: ShieldCheck,
  },
  {
    id: 'quem-fez',
    titulo: 'Quem fez',
    texto:
      'O Elder Web nasceu como Projeto de Conclusão de Curso (TCC) do Curso Técnico em Desenvolvimento de Sistemas da Etec Fernando Prestes, em 2026. Foi desenvolvido por Marcos, Laureane e Jennifer, com o objetivo de utilizar a tecnologia para facilitar o cuidado e a organização da rotina de idosos e de suas redes de apoio.',
    icone: GraduationCap,
  },
]

// ==========================================
// EQUIPE DE DESENVOLVIMENTO
// ==========================================

export const equipe = [
  {
    id: 'marcos',
    nome: 'Marcos Castelli',
    cargo: 'Desenvolvedor',
    foto: fotoMarcos,
    descricao:
      'Líder do projeto. Integrante da equipe responsável pelo backeand, banco de dados, infraestrutura e frontend',
  },
  {
    id: 'laureane',
    nome: 'Laureane Almeida',
    cargo: 'Desenvolvedora',
    foto: fotoLaureane,
    descricao:
      'Integrante da equipe responsável pelo frontend e acessibilidade de telas.',
  },
  {
    id: 'jennifer',
    nome: 'Jennifer Galan',
    cargo: 'Desenvolvedora',
    foto: fotoJennifer,
    descricao:
      'Integrante da equipe responsável pelo frontend e acessibilidade de telas.',
  },
]
