// Verificação ponta a ponta da exclusão de conta (item 9.5, LGPD art. 18): rota REAL (DELETE /usuario/me, app de ./app via
// Supertest), Prisma REAL e SQL Server LOCAL. Os testes de Jest usam um Prisma falso; este script prova o que ele não
// prova: ordem das FKs (NoAction), CHECKs de Usuario e índices únicos filtrados na anonimização, e que o Firebase
// falhando deixa o banco intacto.
//
// Firebase: só duas chamadas são trocadas por duplos locais: auth.verifyIdToken (o "token" é o firebase_uid da conta de
// teste; o duplo devolve auth_time recente, ou antigo com o sufixo |velho) e auth.deleteUser (registra o uid e pode
// falhar sob demanda). Nenhum código de produção é alterado e nenhuma chamada de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida. Todo dado criado é rastreado
// e apagado no finally; as contagens de todas as tabelas são conferidas antes e depois. O prefixo `verify-exclusao-` no
// firebase_uid marca conta residual se o processo for morto no meio (a conta anonimizada mantém o uid). Os textos levam
// uma sentinela única: o script confere 0 ocorrência dela em stdout e stderr.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=...;encrypt=true;trustServerCertificate=true" npx tsx scripts/verify-exclusao-conta.ts
// Recusa rodar se o host de DATABASE_URL não for localhost/127.0.0.1 (nunca contra o Azure).

import { randomUUID } from "node:crypto";

function exigirBancoLocal() {
  const host = /^sqlserver:\/\/([^:;]+)/i.exec(process.env.DATABASE_URL ?? "")?.[1] ?? "";
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`DATABASE_URL aponta para "${host || "(vazio)"}", não para o banco local. Abortado.`);
  }
}

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const ok = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

async function main() {
  exigirBancoLocal();
  // Imports depois da trava: carregar ./app já cria o PrismaClient e o app do Firebase Admin.
  const { default: request } = await import("supertest");
  // app primeiro: ele carrega o dotenv, de que firebaseAdmin depende ao inicializar.
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");

  const deletados: string[] = [];
  let falharFirebase = false;
  const authDuplo = auth as unknown as {
    verifyIdToken: (t: string) => Promise<unknown>;
    deleteUser: (uid: string) => Promise<void>;
  };
  authDuplo.verifyIdToken = async (t) => {
    const [uid, variante] = t.split("|");
    return { uid, email_verified: true, auth_time: Math.floor(Date.now() / 1000) - (variante === "velho" ? 3600 : 10) };
  };
  authDuplo.deleteUser = async (uid) => {
    if (falharFirebase) throw new Error("falha-ficticia-do-firebase");
    deletados.push(uid);
  };

  const tag = randomUUID().slice(0, 8);
  const sentinela = `sentinela-exclusao-${randomUUID()}`;
  const usuarios: number[] = [];

  // Captura stdout/stderr do processo inteiro (inclui o errorHandler e o Prisma) para conferir a sentinela.
  const capturado: string[] = [];
  const outOriginal = process.stdout.write.bind(process.stdout);
  const errOriginal = process.stderr.write.bind(process.stderr);
  const espiar = (original: typeof process.stdout.write) =>
    ((chunk: unknown, ...resto: unknown[]) => {
      capturado.push(String(chunk));
      return (original as (...a: unknown[]) => boolean)(chunk, ...resto);
    }) as typeof process.stdout.write;
  process.stdout.write = espiar(outOriginal);
  process.stderr.write = espiar(errOriginal);

  const prefixo = `verify-exclusao-${tag}`;
  async function conta(perfil: "idoso" | "cuidador" | "familiar", extra: Record<string, unknown> = {}) {
    const uid = `${prefixo}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: {
        firebase_uid: uid,
        nome: `${sentinela}-nome`,
        email: `${uid}@teste.local`,
        telefone: "11900000000",
        tipo_perfil: perfil,
        ultimo_login_em: new Date(),
        aceite_documentos_em: new Date(),
        aceite_documentos_versao: "1.2",
        consentimento_saude_em: new Date(),
        ...extra,
      },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id, token: uid, uid };
  }

  // Idoso sem login (RF-030): cadastrado por um familiar, sem firebase_uid.
  async function idosoSemLogin(cadastranteId: number, extra: Record<string, unknown> = {}) {
    const u = await prisma.usuario.create({
      data: {
        firebase_uid: null,
        nome: `${sentinela}-nome-sem-login`,
        email: `${prefixo}-semlogin-${randomUUID().slice(0, 6)}@teste.local`,
        tipo_perfil: "idoso",
        cadastrado_por_id: cadastranteId,
        termo_responsabilidade_aceito_em: new Date(),
        ...extra,
      },
      select: { id: true },
    });
    usuarios.push(u.id);
    return { id: u.id };
  }

  async function vincular(
    idosoId: number,
    vinculadoId: number,
    tipo: "cuidador" | "familiar",
    status: "aprovado" | "pendente" | "recusado" = "aprovado",
    origem?: string,
  ) {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: origem ?? (tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar"),
        status,
        aprovador_id: status === "pendente" ? null : idosoId,
        data_solicitacao: new Date(),
      },
    });
  }

  // Histórico completo de um idoso, escrito por `autorId`.
  async function historico(idosoId: number, autorId: number) {
    const med = await prisma.medicamento.create({
      data: { idoso_id: idosoId, criado_por_id: autorId, nome: `${sentinela}-med`, dosagem: "10 mg", frequencia: "1x ao dia", data_inicio: new Date("2026-10-01"), ativo: true },
      select: { id: true },
    });
    await prisma.registroDoseMedicamento.create({
      data: { medicamento_id: med.id, registrado_por_id: autorId, data_hora_administracao: new Date(), status_administracao: "administrado" },
    });
    await prisma.registroSaude.create({
      data: { idoso_id: idosoId, registrado_por_id: autorId, editado_por_id: autorId, tipo_medicao: "pressao", valor_1: 120, valor_2: 80, unidade: "mmHg", data_hora: new Date(), observacoes: `${sentinela}-saude` },
    });
    await prisma.registroAlimentar.create({
      data: { idoso_id: idosoId, registrado_por_id: autorId, refeicao: "almoco", descricao: `${sentinela}-alimento`, data_hora: new Date() },
    });
    await prisma.evento.create({
      data: { idoso_id: idosoId, criado_por_id: autorId, tipo_evento: "pessoal", titulo: `${sentinela}-evento`, data_hora_inicio: new Date() },
    });
  }

  const doIdoso = async (id: number) => ({
    med: await prisma.medicamento.count({ where: { idoso_id: id } }),
    dose: await prisma.registroDoseMedicamento.count({ where: { medicamento: { idoso_id: id } } }),
    saude: await prisma.registroSaude.count({ where: { idoso_id: id } }),
    alimentar: await prisma.registroAlimentar.count({ where: { idoso_id: id } }),
    evento: await prisma.evento.count({ where: { idoso_id: id } }),
    vinculo: await prisma.vinculo.count({ where: { idoso_id: id } }),
  });
  const todosOs = (c: Awaited<ReturnType<typeof doIdoso>>, n: number) => Object.values(c).every((v) => v === n);
  const linha = (id: number) => prisma.usuario.findUnique({ where: { id } });
  const excluir = (token: string, corpo: object = { confirmacao: "EXCLUIR" }) =>
    request(app).delete("/usuario/me").set("Authorization", `Bearer ${token}`).send(corpo);
  const contagens = async () => ({
    usuario: await prisma.usuario.count(),
    vinculo: await prisma.vinculo.count(),
    medicamento: await prisma.medicamento.count(),
    dose: await prisma.registroDoseMedicamento.count(),
    saude: await prisma.registroSaude.count(),
    alimentar: await prisma.registroAlimentar.count(),
    evento: await prisma.evento.count(),
  });
  const antes = await contagens();

  try {
    // ---- 1: idoso com histórico completo e vínculos, com o cuidador escrevendo também em outro idoso ----
    const idoso = await conta("idoso", {
      cadastrado_por_id: null,
      foto_perfil: Buffer.from("foto-ficticia"),
      foto_perfil_mime_type: "image/webp",
      foto_perfil_atualizada_em: new Date(),
      email_convite_familiar: "convite@teste.local",
      modo_decisao: "idoso",
    });
    const outroIdoso = await conta("idoso", { modo_decisao: "idoso" });
    const cuidador = await conta("cuidador");
    const familiar = await conta("familiar");
    await vincular(idoso.id, cuidador.id, "cuidador");
    await vincular(idoso.id, familiar.id, "familiar");
    await vincular(outroIdoso.id, cuidador.id, "cuidador");
    await historico(idoso.id, cuidador.id);
    await historico(outroIdoso.id, cuidador.id);

    const r1 = await excluir(idoso.token);
    const c1 = await doIdoso(idoso.id);
    const l1 = await linha(idoso.id);
    ok("idoso com histórico completo: 204 (nenhuma FK nem CHECK estourou)", r1.status === 204 && r1.text === "", `status ${r1.status}`);
    ok("dados do idoso apagados nas 6 tabelas (doses antes dos medicamentos)", todosOs(c1, 0), JSON.stringify(c1));
    ok(
      "linha do idoso anonimizada (nome, e-mail, telefone, foto, convite, login) e mantida",
      !!l1 && l1.nome === "Conta excluída" && l1.email === `excluido-${idoso.id}@excluido.invalid` && l1.telefone === null && l1.foto_perfil === null && l1.foto_perfil_mime_type === null && l1.foto_perfil_atualizada_em === null && l1.email_convite_familiar === null && l1.ultimo_login_em === null && l1.modo_decisao === null,
      l1 ? `nome ${l1.nome}` : "linha sumiu",
    );
    ok("prova de aceite e uid preservados na linha anonimizada", !!l1 && l1.aceite_documentos_versao === "1.2" && l1.aceite_documentos_em !== null && l1.consentimento_saude_em !== null && l1.firebase_uid === idoso.uid, "ok");
    ok("Firebase chamado uma vez, com o uid do idoso", deletados.length === 1 && deletados[0] === idoso.uid, `${deletados.length} chamada(s)`);
    const cuidadorLinha = await linha(cuidador.id);
    const familiarLinha = await linha(familiar.id);
    ok("cuidador e familiar do idoso não foram tocados", cuidadorLinha?.nome === `${sentinela}-nome` && familiarLinha?.nome === `${sentinela}-nome`, "ok");

    // ---- 2: cuidador com registros em idoso alheio ----
    const c2antes = await doIdoso(outroIdoso.id);
    const r2 = await excluir(cuidador.token);
    const c2 = await doIdoso(outroIdoso.id);
    const l2 = await linha(cuidador.id);
    const saudeOutro = await prisma.registroSaude.findFirst({ where: { idoso_id: outroIdoso.id } });
    ok("cuidador com registros em idoso alheio: 204", r2.status === 204, `status ${r2.status}`);
    ok(
      "o que o cuidador escreveu sobre o outro idoso fica, com a autoria apontando para a linha anonimizada",
      c2.med === c2antes.med && c2.dose === c2antes.dose && c2.saude === c2antes.saude && c2.alimentar === c2antes.alimentar && c2.evento === c2antes.evento && saudeOutro?.registrado_por_id === cuidador.id && saudeOutro?.editado_por_id === cuidador.id,
      JSON.stringify(c2),
    );
    ok("vínculo do cuidador com o outro idoso saiu; a linha do cuidador está anonimizada", c2.vinculo === c2antes.vinculo - 1 && l2?.nome === "Conta excluída", `vinculos ${c2.vinculo}`);

    // ---- 3: familiar que cadastrou idoso sem login, sem outro vínculo aprovado ----
    const familiar3 = await conta("familiar");
    const semLogin3 = await idosoSemLogin(familiar3.id);
    await vincular(semLogin3.id, familiar3.id, "familiar", "aprovado", "cadastro_familiar");
    await historico(semLogin3.id, familiar3.id);
    const r3 = await excluir(familiar3.token);
    const c3 = await doIdoso(semLogin3.id);
    const l3 = await linha(semLogin3.id);
    ok("familiar que cadastrou idoso sem login e sem outro vínculo: 204", r3.status === 204, `status ${r3.status}`);
    ok("idoso sem login e sem ninguém com acesso: dados apagados", todosOs(c3, 0), JSON.stringify(c3));
    ok(
      "idoso sem login anonimizado (e-mail único por id, uid segue nulo, cadastrante preservado)",
      !!l3 && l3.nome === "Conta excluída" && l3.email === `excluido-${semLogin3.id}@excluido.invalid` && l3.firebase_uid === null && l3.cadastrado_por_id === familiar3.id && l3.termo_responsabilidade_aceito_em === null,
      l3 ? `nome ${l3.nome}` : "linha sumiu",
    );

    // ---- 4: o mesmo, com outro vínculo aprovado (cuidador): o idoso fica ----
    const familiar4 = await conta("familiar");
    const cuidador4 = await conta("cuidador");
    const semLogin4 = await idosoSemLogin(familiar4.id, { modo_decisao: "familiar" });
    await vincular(semLogin4.id, familiar4.id, "familiar", "aprovado", "cadastro_familiar");
    await vincular(semLogin4.id, cuidador4.id, "cuidador");
    await historico(semLogin4.id, familiar4.id);
    const r4 = await excluir(familiar4.token);
    const c4 = await doIdoso(semLogin4.id);
    const l4 = await linha(semLogin4.id);
    ok("familiar que cadastrou idoso sem login com outro vínculo aprovado: 204", r4.status === 204, `status ${r4.status}`);
    ok("idoso sem login com outro vínculo aprovado fica com os dados e só perde o vínculo do cadastrante", c4.med === 1 && c4.dose === 1 && c4.saude === 1 && c4.alimentar === 1 && c4.evento === 1 && c4.vinculo === 1, JSON.stringify(c4));
    ok("e volta de 'familiar' para 'idoso' (nenhum familiar aprovado restou)", l4?.nome === `${sentinela}-nome-sem-login` && l4?.modo_decisao === "idoso", `modo ${l4?.modo_decisao}`);

    // ---- 5: último familiar de um idoso com login e modo_decisao 'familiar' ----
    const idoso5 = await conta("idoso", { modo_decisao: "familiar" });
    const familiar5 = await conta("familiar");
    await vincular(idoso5.id, familiar5.id, "familiar");
    const r5 = await excluir(familiar5.token);
    const l5 = await linha(idoso5.id);
    ok("último familiar aprovado de idoso decidido por 'familiar': 204 e o idoso volta para 'idoso'", r5.status === 204 && l5?.modo_decisao === "idoso", `status ${r5.status}, modo ${l5?.modo_decisao}`);

    // ---- 6: login antigo e confirmação inválida: nada acontece ----
    const idoso6 = await conta("idoso");
    await historico(idoso6.id, idoso6.id);
    const n6 = deletados.length;
    const r6a = await excluir(`${idoso6.token}|velho`);
    const r6b = await excluir(idoso6.token, { confirmacao: "excluir" });
    const c6 = await doIdoso(idoso6.id);
    ok(
      "login antigo (401 reautenticar) e confirmação errada (400): nada apagado, Firebase não chamado",
      r6a.status === 401 && r6a.body.codigo === "reautenticar" && r6b.status === 400 && c6.med === 1 && c6.dose === 1 && c6.saude === 1 && c6.alimentar === 1 && c6.evento === 1 && deletados.length === n6,
      `status ${r6a.status}/${r6b.status}`,
    );

    // ---- 7: Firebase falha: 502 e banco intacto ----
    const idoso7 = await conta("idoso", { modo_decisao: "idoso" });
    const cuidador7 = await conta("cuidador");
    await vincular(idoso7.id, cuidador7.id, "cuidador");
    await historico(idoso7.id, cuidador7.id);
    const antes7 = await doIdoso(idoso7.id);
    const linhaAntes7 = JSON.stringify(await linha(idoso7.id));
    falharFirebase = true;
    const r7 = await excluir(idoso7.token);
    falharFirebase = false;
    const depois7 = await doIdoso(idoso7.id);
    ok("Firebase falhando: 502 com a mensagem fixa", r7.status === 502 && r7.body.error === "Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo em alguns minutos.", `status ${r7.status}`);
    ok("Firebase falhando: o banco inteiro foi desfeito (6 tabelas e a linha de Usuario iguais)", JSON.stringify(antes7) === JSON.stringify(depois7) && JSON.stringify(await linha(idoso7.id)) === linhaAntes7, JSON.stringify(depois7));
    const r7b = await excluir(idoso7.token);
    ok("depois que o Firebase volta, a mesma conta é excluída normalmente", r7b.status === 204 && (await linha(idoso7.id))?.nome === "Conta excluída", `status ${r7b.status}`);
  } finally {
    // Ordem de FK: doses, medicamentos, registros, eventos, vínculos; depois as referências entre contas; por fim as contas.
    const m = await prisma.medicamento.findMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { criado_por_id: { in: usuarios } }] }, select: { id: true } });
    await prisma.registroDoseMedicamento.deleteMany({ where: { OR: [{ medicamento_id: { in: m.map((x) => x.id) } }, { registrado_por_id: { in: usuarios } }] } });
    await prisma.medicamento.deleteMany({ where: { id: { in: m.map((x) => x.id) } } });
    await prisma.registroSaude.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { registrado_por_id: { in: usuarios } }] } });
    await prisma.registroAlimentar.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { registrado_por_id: { in: usuarios } }] } });
    await prisma.evento.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { criado_por_id: { in: usuarios } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: usuarios } }, { vinculado_id: { in: usuarios } }] } });
    await prisma.usuario.updateMany({
      where: { id: { in: usuarios } },
      data: { modo_decisao_solicitado: null, modo_decisao_solicitado_por_id: null, modo_decisao_solicitado_em: null, modo_decisao_expira_em: null, modo_decisao_segunda_confirmacao_id: null, modo_decisao_alterado_por_id: null },
    });
    // Contas com login primeiro soltam o cadastrante (CHECK do termo e do uid obrigam a ordem); depois saem as sem login.
    await prisma.usuario.updateMany({ where: { id: { in: usuarios }, firebase_uid: { not: null } }, data: { cadastrado_por_id: null, termo_responsabilidade_aceito_em: null } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios }, firebase_uid: null } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
    const depois = await contagens();
    for (const [tabela, n] of Object.entries(antes)) {
      ok(`COUNT(*) de ${tabela} depois da limpeza = antes`, depois[tabela as keyof typeof depois] === n, `antes ${n}, depois ${depois[tabela as keyof typeof depois]}`);
    }
    const sobras = await prisma.usuario.count({ where: { firebase_uid: { startsWith: prefixo } } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    await prisma.$disconnect();
    process.stdout.write = outOriginal;
    process.stderr.write = errOriginal;
    const vazou = capturado.join("").split(sentinela).length - 1;
    ok("0 ocorrências da sentinela em stdout e stderr", vazou === 0, `${vazou} ocorrência(s)`);
  }

  console.log("\nCenário".padEnd(100) + "Resultado");
  console.log("-".repeat(124));
  for (const r of results) console.log(r.name.padEnd(100) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
