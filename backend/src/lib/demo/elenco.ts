// Modo demonstração (D3): elenco fixo de contas FICTÍCIAS, usado só em apresentações. Fonte única para as rotas de
// /demo, a semente e os testes. Cada conta tem tipo_perfil fixo (nada de perfil híbrido): "trocar de perfil" é entrar
// em outra conta deste elenco por custom token. Sinalização de dado falso: uid com prefixo demo- e e-mail .test.
export type ContaDemo = {
  slug: string;
  uid: string;
  email: string;
  nome: string;
  tipo_perfil: "idoso" | "cuidador" | "familiar";
  descricao: string;
};

const conta = (slug: string, nome: string, tipo_perfil: ContaDemo["tipo_perfil"], descricao: string): ContaDemo => ({
  slug,
  uid: `demo-${slug}`,
  email: `${slug}@demo.elderweb.test`,
  nome,
  tipo_perfil,
  descricao,
});

export const ELENCO: readonly ContaDemo[] = [
  conta("idosa-helena", "Helena Prado", "idoso", "Idosa que decide por si. Conta principal, com mais dados."),
  conta("idoso-antonio", "Antônio Ribeiro", "idoso", "Idoso que passou as decisões para a família."),
  conta("cuidadora-marta", "Marta Souza", "cuidador", "Cuidadora de Helena (todas as permissões) e de Antônio (só doses)."),
  conta("cuidador-paulo", "Paulo Lima", "cuidador", "Cuidador com pedido de vínculo esperando a aprovação de Helena."),
  conta("familiar-carlos", "Carlos Prado", "familiar", "Filho de Helena. Só acompanha, sem editar."),
  conta("familiar-renata", "Renata Ribeiro", "familiar", "Filha de Antônio. Decide e registra por ele."),
];

const SLUGS: readonly string[] = ELENCO.map((c) => c.slug);
export const UIDS_ELENCO: readonly string[] = ELENCO.map((c) => c.uid);

// Lista fechada: includes antes do find, então só uma string exata da lista passa (nada de __proto__, uid ou objeto).
export function contaPorSlug(valor: unknown): ContaDemo | undefined {
  if (typeof valor !== "string" || !SLUGS.includes(valor)) return undefined;
  return ELENCO.find((c) => c.slug === valor);
}

// Comparação exata contra a lista fechada, nunca por prefixo.
export function ehUidDemo(uid: unknown): boolean {
  return typeof uid === "string" && UIDS_ELENCO.includes(uid);
}
