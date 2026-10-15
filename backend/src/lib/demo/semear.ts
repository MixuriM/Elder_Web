import type { Prisma, PrismaClient } from "@prisma/client";
import type { Auth } from "firebase-admin/auth";
import { ehUidDemo, ELENCO, UIDS_ELENCO } from "./elenco";
import { montarDadosDemo, type DadosDemo } from "./dados";

// Modo demonstração (D5): grava a semente de montarDadosDemo e a remove. prisma e auth entram por parâmetro (teste
// com fakes, CLI e rota com os reais). Escopo SEMPRE pela lista fechada de uids do elenco, nunca por LIKE nem por dado
// de fora. Usuario do elenco é atualizado no lugar (id estável), o resto das linhas ligadas ao elenco é apagado e
// recriado numa transação. Sem log: os dados são fictícios, mas as tabelas são de saúde.
export type AuthDemo = Pick<Auth, "getUser" | "getUserByEmail" | "createUser" | "updateUser" | "deleteUser">;
type Tx = Prisma.TransactionClient;
type Contagens = { usuarios: number; vinculos: number; saude: number; medicamentos: number; doses: number; eventos: number; refeicoes: number };

// Mensagem fixa: nunca cita e-mail, id nem nome do usuário estranho (o CLI imprime esta mesma frase).
export const MSG_INVASOR = "Há um usuário estranho ocupando um e-mail reservado da demonstração. Remova-o manualmente.";
export class ErroSemente extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroSemente";
  }
}

const DOMINIO_RESERVADO = "@demo.elderweb.test"; // .test é reservado (RFC 6761): ninguém real recebe e-mail nele
const ehEmailReservado = (email: unknown) => typeof email === "string" && email.toLowerCase().endsWith(DOMINIO_RESERVADO);
const naoExiste = (e: unknown) => (e as { code?: unknown }).code === "auth/user-not-found";

// Prazo folgado: no Azure (plano básico) a transação inteira, com cerca de 200 linhas, leva alguns segundos.
const OPCOES_TRANSACAO = { maxWait: 20_000, timeout: 60_000 };

async function idsDoElenco(tx: Tx): Promise<number[]> {
  const linhas = await tx.usuario.findMany({ where: { firebase_uid: { in: [...UIDS_ELENCO] } }, select: { id: true } });
  return linhas.map((l) => l.id);
}

// Apaga as linhas de domínio cujo idoso OU autor é conta do elenco (doses antes de medicamento, por causa da FK).
async function limparDominio(tx: Tx, ids: number[]): Promise<Omit<Contagens, "usuarios">> {
  if (ids.length === 0) return { vinculos: 0, saude: 0, medicamentos: 0, doses: 0, eventos: 0, refeicoes: 0 };
  const doElenco = { in: ids };
  const meds = await tx.medicamento.findMany({
    where: { OR: [{ idoso_id: doElenco }, { criado_por_id: doElenco }, { editado_por_id: doElenco }] },
    select: { id: true },
  });
  const medIds = meds.map((m) => m.id);
  const doses = await tx.registroDoseMedicamento.deleteMany({
    where: { OR: [{ medicamento_id: { in: medIds } }, { registrado_por_id: doElenco }] },
  });
  const vinculos = await tx.vinculo.deleteMany({
    where: { OR: [{ idoso_id: doElenco }, { vinculado_id: doElenco }, { aprovador_id: doElenco }, { definido_por_id: doElenco }] },
  });
  const medicamentos = await tx.medicamento.deleteMany({ where: { id: { in: medIds } } });
  const saude = await tx.registroSaude.deleteMany({
    where: { OR: [{ idoso_id: doElenco }, { registrado_por_id: doElenco }, { editado_por_id: doElenco }] },
  });
  const refeicoes = await tx.registroAlimentar.deleteMany({
    where: { OR: [{ idoso_id: doElenco }, { registrado_por_id: doElenco }, { editado_por_id: doElenco }] },
  });
  const eventos = await tx.evento.deleteMany({
    where: { OR: [{ idoso_id: doElenco }, { criado_por_id: doElenco }, { editado_por_id: doElenco }] },
  });
  return { vinculos: vinculos.count, saude: saude.count, medicamentos: medicamentos.count, doses: doses.count, eventos: eventos.count, refeicoes: refeicoes.count };
}

// Passo (a), sem efeito colateral: Usuario de fora do elenco com e-mail reservado impede a semente (o INSERT bateria no
// índice único de e-mail e a demonstração ficaria pela metade). Aborta antes de apagar ou gravar qualquer coisa.
async function exigirSemInvasorNoBanco(prisma: PrismaClient) {
  const achados = await prisma.usuario.findMany({ where: { email: { in: ELENCO.map((c) => c.email) } }, select: { firebase_uid: true } });
  if (achados.some((u) => !ehUidDemo(u.firebase_uid))) throw new ErroSemente(MSG_INVASOR);
}

// Passo (b): contas no Firebase, criadas ou atualizadas por uid, com e-mail verificado e SEM senha. Ninguém entra nelas
// por senha nem por Google (o e-mail .test não existe); só o custom token emitido por /demo/entrar-como. Conta de fora do
// elenco com e-mail reservado é invasora e é apagada; conta com qualquer outro e-mail nunca é apagada. Idempotente.
async function prepararContasFirebase(auth: AuthDemo) {
  for (const c of ELENCO) {
    const dono = await auth.getUserByEmail(c.email).catch((e: unknown) => {
      if (naoExiste(e)) return null;
      throw e;
    });
    if (dono && dono.uid !== c.uid && !ehUidDemo(dono.uid) && ehEmailReservado(dono.email)) await auth.deleteUser(dono.uid);

    const perfil = { email: c.email, displayName: c.nome, emailVerified: true, disabled: false };
    try {
      await auth.getUser(c.uid);
    } catch (e) {
      if (!naoExiste(e)) throw e;
      await auth.createUser({ uid: c.uid, ...perfil });
      continue;
    }
    await auth.updateUser(c.uid, perfil);
  }
}

// Ordem (D2): (a) preflight, (b) Firebase, (c) transação do banco. Falha de Firebase ou de pré-condição deixa o banco
// intacto; falha na transação volta tudo (rollback) e o demo que estava no ar continua como estava.
export async function semearDemo({ prisma, auth, agora }: { prisma: PrismaClient; auth: AuthDemo; agora: Date }): Promise<Contagens> {
  await exigirSemInvasorNoBanco(prisma);
  await prepararContasFirebase(auth);
  return gravarNoBanco(prisma, montarDadosDemo(agora));
}

async function gravarNoBanco(prisma: PrismaClient, d: DadosDemo): Promise<Contagens> {
  return prisma.$transaction(async (tx) => {
    await limparDominio(tx, await idsDoElenco(tx));

    // Usuario do elenco: volta ao estado da semente (desfaz troca de e-mail, de modo de decisão e foto).
    const id: Record<string, number> = {};
    for (const c of ELENCO) {
      const u = d.usuarios.find((x) => x.slug === c.slug)!;
      const dados = {
        nome: c.nome,
        email: c.email,
        telefone: null,
        tipo_perfil: c.tipo_perfil,
        email_convite_familiar: null,
        cadastrado_por_id: null,
        termo_responsabilidade_aceito_em: null,
        modo_decisao: u.modo_decisao,
        ultimo_login_em: null,
        modo_decisao_solicitado: null,
        modo_decisao_solicitado_por_id: null,
        modo_decisao_solicitado_em: null,
        modo_decisao_expira_em: null,
        modo_decisao_segunda_confirmacao_id: null,
        modo_decisao_alterado_por_id: null,
        modo_decisao_alterado_em: u.modo_decisao_alterado_em,
        modo_decisao_motivo: null,
        foto_perfil: null,
        foto_perfil_mime_type: null,
        foto_perfil_atualizada_em: null,
        aceite_documentos_em: u.aceite_documentos_em,
        aceite_documentos_versao: u.aceite_documentos_versao,
        consentimento_saude_em: u.aceite_documentos_em,
      };
      const existente = await tx.usuario.findMany({ where: { firebase_uid: c.uid }, select: { id: true } });
      id[c.slug] =
        existente.length > 0
          ? (await tx.usuario.update({ where: { id: existente[0].id }, data: dados, select: { id: true } })).id
          : (await tx.usuario.create({ data: { firebase_uid: c.uid, ...dados }, select: { id: true } })).id;
    }
    // Autorrelação só depois de todos os ids existirem.
    for (const u of d.usuarios.filter((x) => x.modo_decisao_alterado_por !== null)) {
      await tx.usuario.update({ where: { id: id[u.slug] }, data: { modo_decisao_alterado_por_id: id[u.modo_decisao_alterado_por!] }, select: { id: true } });
    }
    const ref = (slug: string | null) => (slug === null ? null : id[slug]);

    const vinculos = await tx.vinculo.createMany({
      data: d.vinculos.map(({ idoso, vinculado, aprovador, definido_por, ...v }) => ({
        ...v,
        idoso_id: id[idoso],
        vinculado_id: id[vinculado],
        aprovador_id: ref(aprovador),
        definido_por_id: ref(definido_por),
      })),
    });
    const saude = await tx.registroSaude.createMany({
      data: d.saude.map(({ idoso, registrado_por, ...r }) => ({
        ...r,
        idoso_id: id[idoso],
        registrado_por_id: id[registrado_por],
        editado_por_id: id[registrado_por], // RNF-006: obrigatório; a criação grava o próprio autor
      })),
    });
    let doses = 0;
    for (const { idoso, criado_por, data_inicio, data_fim, doses: lista, ...m } of d.medicamentos) {
      await tx.medicamento.create({
        data: {
          ...m,
          idoso_id: id[idoso],
          criado_por_id: id[criado_por],
          editado_por_id: null,
          data_inicio: new Date(`${data_inicio}T00:00:00.000Z`),
          data_fim: data_fim === null ? null : new Date(`${data_fim}T00:00:00.000Z`),
          doses: {
            create: lista.map(({ registrado_por, data_hora, ...x }) => ({
              ...x,
              registrado_por_id: id[registrado_por],
              data_hora_administracao: data_hora,
            })),
          },
        },
        select: { id: true },
      });
      doses += lista.length;
    }
    const eventos = await tx.evento.createMany({
      data: d.eventos.map(({ idoso, criado_por, ...e }) => ({ ...e, idoso_id: id[idoso], criado_por_id: id[criado_por], editado_por_id: null })),
    });
    const refeicoes = await tx.registroAlimentar.createMany({
      data: d.refeicoes.map(({ idoso, registrado_por, ...r }) => ({ ...r, idoso_id: id[idoso], registrado_por_id: id[registrado_por], editado_por_id: null })),
    });
    return {
      usuarios: ELENCO.length,
      vinculos: vinculos.count,
      saude: saude.count,
      medicamentos: d.medicamentos.length,
      doses,
      eventos: eventos.count,
      refeicoes: refeicoes.count,
    };
  }, OPCOES_TRANSACAO);
}

// Remove tudo do elenco, inclusive as contas. Se alguma linha de fora do elenco ainda apontar para uma conta do
// elenco (FK), o DELETE falha e a transação inteira volta: falha fechada, nada de usuário real é apagado.
export async function removerDemo({ prisma, auth }: { prisma: PrismaClient; auth: AuthDemo }): Promise<Contagens> {
  const contagens = await prisma.$transaction(async (tx) => {
    const ids = await idsDoElenco(tx);
    const dominio = await limparDominio(tx, ids);
    const usuarios = ids.length === 0 ? { count: 0 } : await tx.usuario.deleteMany({ where: { id: { in: ids } } });
    return { usuarios: usuarios.count, ...dominio };
  }, OPCOES_TRANSACAO);
  // D4: apaga as contas no Firebase para as sessões demo existentes pararem de renovar o token.
  for (const uid of UIDS_ELENCO) {
    await auth.deleteUser(uid).catch((e: unknown) => {
      if (!naoExiste(e)) throw e;
    });
  }
  return contagens;
}
