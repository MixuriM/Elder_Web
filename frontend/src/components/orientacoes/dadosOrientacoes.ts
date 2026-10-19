
export interface Orientacao {
  id: string
  titulo: string
  texto: string
}

export const secoesOrientacoes: Orientacao[] = [
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
