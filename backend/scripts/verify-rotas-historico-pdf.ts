// Verificação ponta a ponta do item 5.4 (RF-014): rota REAL (app de ./app via Supertest), Prisma REAL e
// SQL Server LOCAL. Os testes de Jest mockam o Prisma; este script exercita o caminho inteiro junto, incluindo
// o PDF extraído de verdade (pdfjs-dist, o mesmo de testSupport/extrairTextoPdf.ts).
//
// Firebase: só a validação do ID Token é trocada. auth.verifyIdToken passa a devolver { uid: <token> },
// então o "token" enviado é o firebase_uid da conta de teste. Nenhum código de produção é alterado e
// nenhuma chamada de rede ao Firebase acontece.
//
// Limpeza: as rotas usam o prisma global, então não dá para rodar numa transação revertida (mesma exceção
// deliberada de verify-rotas-historico-remedios.ts). Toda linha criada carrega uma sentinela única da execução
// (tag no firebase_uid das contas e no nome dos medicamentos). O finally apaga SÓ as linhas com essa sentinela
// (doses, registros de saúde, vínculos, medicamentos, contas, nessa ordem). Se o COUNT(*) das tabelas depois da
// limpeza diferir do inicial, o script falha alto e lista o que sobrou. As sentinelas nunca podem aparecer em
// stdout/stderr durante as requisições.
//
// Uso (dentro de backend/, contra o SQL Server LOCAL do docker-compose.yml, porta 14330):
//   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=${MSSQL_SA_PASSWORD};trustServerCertificate=true" \
//     npx tsx scripts/verify-rotas-historico-pdf.ts
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

type Corpo = Buffer | { error?: string } | null;

async function main() {
  exigirBancoLocal();
  // Imports depois da trava: carregar ./app já cria o PrismaClient e o app do Firebase Admin.
  const { default: request } = await import("supertest");
  // app primeiro: ele carrega o dotenv, de que firebaseAdmin depende ao inicializar.
  const { default: app } = await import("../src/app");
  const { auth } = await import("../src/lib/firebaseAdmin");
  const { prisma } = await import("../src/lib/prisma");
  const { extrairTextoPdf } = await import("../src/testSupport/extrairTextoPdf");

  (auth as unknown as { verifyIdToken: (t: string) => Promise<unknown> }).verifyIdToken = async (t) => ({
    uid: t,
    email_verified: true,
  });

  const tag = randomUUID().slice(0, 8);
  const SENT_A = `SENT_VERIFY_A_${tag}`;
  const SENT_B = `SENT_VERIFY_B_${tag}`;

  async function conta(perfil: "idoso" | "cuidador" | "familiar", nome = "Conta de Teste") {
    const uid = `verify-pdf-${tag}-${perfil}-${randomUUID().slice(0, 6)}`;
    const u = await prisma.usuario.create({
      data: { firebase_uid: uid, nome, email: `${uid}@teste.local`, tipo_perfil: perfil, modo_decisao: null },
      select: { id: true },
    });
    return { id: u.id, token: uid };
  }

  async function vincular(idosoId: number, vinculadoId: number, tipo: "cuidador" | "familiar", status: "aprovado" | "pendente" | "recusado") {
    await prisma.vinculo.create({
      data: {
        idoso_id: idosoId,
        vinculado_id: vinculadoId,
        tipo_vinculo: tipo,
        origem: tipo === "cuidador" ? "solicitacao_cuidador" : "solicitacao_familiar",
        status,
        aprovador_id: status === "pendente" ? null : idosoId,
        data_solicitacao: new Date(),
        permite_marcar_dose: false,
        permite_registrar_saude: false,
        permite_criar_evento_cuidado: false,
      },
    });
  }

  async function med(idosoId: number, nome: string, inicio: string, fim: string | null, ativo: boolean) {
    const m = await prisma.medicamento.create({
      data: {
        idoso_id: idosoId,
        criado_por_id: idosoId,
        editado_por_id: null,
        nome,
        dosagem: "10 mg",
        frequencia: "2x ao dia",
        data_inicio: new Date(`${inicio}T00:00:00.000Z`),
        data_fim: fim === null ? null : new Date(`${fim}T00:00:00.000Z`),
        observacoes: nome,
        ativo,
      },
      select: { id: true },
    });
    return m.id;
  }

  const dose = (medicamentoId: number, registradoPor: number, quando: string, status: string, obs: string | null) =>
    prisma.registroDoseMedicamento.create({
      data: { medicamento_id: medicamentoId, registrado_por_id: registradoPor, data_hora_administracao: new Date(quando), status_administracao: status, observacoes: obs },
    });

  const registro = (idosoId: number, tipo: string, v1: string, v2: string | null, unidade: string, quando: string, obs: string | null) =>
    prisma.registroSaude.create({
      data: { idoso_id: idosoId, registrado_por_id: idosoId, editado_por_id: idosoId, tipo_medicao: tipo, valor_1: v1, valor_2: v2, unidade, data_hora: new Date(quando), observacoes: obs },
    });

  const contagens = async () => ({
    med: await prisma.medicamento.count(),
    dose: await prisma.registroDoseMedicamento.count(),
    reg: await prisma.registroSaude.count(),
  });

  // Supertest entrega o PDF como Buffer; erro (JSON) vira objeto.
  const get = (token: string, caminho: string) =>
    request(app)
      .get(caminho)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(partes);
          if (String(res.headers["content-type"] ?? "").startsWith("application/pdf")) return cb(null, buf);
          cb(null, buf.length ? (JSON.parse(buf.toString("utf8")) as Corpo) : null);
        });
      });
  const semGeradoEm = (t: string) => t.split("\n").filter((l) => !l.startsWith("Gerado em")).join("\n");

  const antes = await contagens();
  try {
    const idoso = await conta("idoso", `${SENT_A}_IDOSO Conceição`);
    const idosoB = await conta("idoso", `${SENT_B}_IDOSO`);
    const cuidador = await conta("cuidador"); // aprovado, as 3 flags false
    const cuidadorRec = await conta("cuidador"); // recusado
    const familiar = await conta("familiar"); // aprovado, modo_decisao NULL (efetivo 'idoso')
    const familiarPend = await conta("familiar"); // pendente
    await vincular(idoso.id, cuidador.id, "cuidador", "aprovado");
    await vincular(idoso.id, cuidadorRec.id, "cuidador", "recusado");
    await vincular(idoso.id, familiar.id, "familiar", "aprovado");
    await vincular(idoso.id, familiarPend.id, "familiar", "pendente");

    // Idoso A: m1 ativo com 2 doses (um nome acentuado), m2 inativo e já encerrado, m3 ativo sem doses e futuro.
    const m1 = await med(idoso.id, `${SENT_A}_Medicação`, "2026-03-01", null, true);
    const m2 = await med(idoso.id, `${SENT_A}_M2`, "2026-08-15", "2026-09-01", false);
    await med(idoso.id, `${SENT_A}_M3`, "2026-12-01", null, true);
    await dose(m1, idoso.id, "2026-09-10T08:00:00.000Z", "pulado", `${SENT_A}_DOSE`);
    await dose(m1, idoso.id, "2026-09-14T12:30:00.000Z", "administrado", null);
    await registro(idoso.id, "pressao", "120", "80", "mmHg", "2026-09-24T12:00:00.000Z", `${SENT_A}_REG`);
    await registro(idoso.id, "temperatura", "36.6", null, "°C", "2026-09-25T12:00:00.000Z", null);
    // Idoso B: nada disto pode chegar ao A nem a quem só tem vínculo com o A.
    const mB = await med(idosoB.id, `${SENT_B}_M`, "2026-09-01", null, true);
    await dose(mB, idosoB.id, "2026-09-21T09:00:00.000Z", "administrado", `${SENT_B}_DOSE`);
    await registro(idosoB.id, "pressao", "777.77", "666.66", "mmHg", "2026-09-26T12:00:00.000Z", `${SENT_B}_REG`);
    void m2;

    const seeded = await contagens();

    // Tudo que as rotas escreverem em stdout/stderr durante as requisições é capturado e procurado por sentinela.
    // A extração do texto dos PDFs roda DEPOIS, fora da janela de captura.
    let saida = "";
    const outOriginal = process.stdout.write.bind(process.stdout);
    const errOriginal = process.stderr.write.bind(process.stderr);
    const capturar = (chunk: unknown) => {
      saida += String(chunk);
      return true;
    };
    process.stdout.write = capturar as typeof process.stdout.write;
    process.stderr.write = capturar as typeof process.stderr.write;
    let controleCapturado = false;
    let doIdoso, doFamiliar, doCuidador, p1, p2, cruzado, doIdosoB, semToken, idCurto;
    try {
      process.stdout.write(`CONTROLE_${tag}`);
      controleCapturado = saida.includes(`CONTROLE_${tag}`);
      doIdoso = await get(idoso.token, "/historico/pdf");
      doFamiliar = await get(familiar.token, `/historico/idoso/${idoso.id}/pdf`);
      doCuidador = await get(cuidador.token, `/historico/idoso/${idoso.id}/pdf`);
      p1 = await get(familiarPend.token, `/historico/idoso/${idoso.id}/pdf`);
      p2 = await get(cuidadorRec.token, `/historico/idoso/${idoso.id}/pdf`);
      cruzado = await get(familiar.token, `/historico/idoso/${idosoB.id}/pdf`);
      doIdosoB = await get(idosoB.token, "/historico/pdf");
      semToken = await request(app).get("/historico/pdf");
      idCurto = await get(familiar.token, "/historico/idoso/abc/pdf");
    } finally {
      process.stdout.write = outOriginal;
      process.stderr.write = errOriginal;
    }

    const pdfDe = (r: { body: unknown }) => r.body as Buffer;
    const textoIdoso = await extrairTextoPdf(pdfDe(doIdoso));
    const textoFamiliar = await extrairTextoPdf(pdfDe(doFamiliar));
    const textoCuidador = await extrairTextoPdf(pdfDe(doCuidador));
    const textoIdosoB = await extrairTextoPdf(pdfDe(doIdosoB));
    const t = textoIdoso.texto;

    ok("captura de stdout funciona (controle positivo)", controleCapturado, controleCapturado ? "capturou" : "não capturou");
    ok(
      "idoso exporta o próprio: 200, application/pdf e headers de download",
      doIdoso.status === 200 &&
        String(doIdoso.headers["content-type"]).startsWith("application/pdf") &&
        doIdoso.headers["content-disposition"] === 'attachment; filename="historico-saude-remedios.pdf"' &&
        doIdoso.headers["cache-control"] === "no-store" &&
        doIdoso.headers["x-content-type-options"] === "nosniff",
      `status ${doIdoso.status}, ${String(doIdoso.headers["content-type"])}`,
    );
    const buf = pdfDe(doIdoso);
    ok("corpo começa com %PDF e termina com %%EOF", buf.subarray(0, 4).toString("latin1") === "%PDF" && buf.toString("latin1").trimEnd().endsWith("%%EOF"), `${buf.length} byte(s)`);
    ok("texto extraído traz o nome do idoso (com acento) e o cabeçalho", t.includes(`${SENT_A}_IDOSO Conceição`) && t.includes("Gerado em"), "nome e 'Gerado em'");
    ok("medicamentos do A (acentuado, inativo, futuro) e doses com situação", t.includes(`${SENT_A}_Medicação`) && t.includes(`${SENT_A}_M2`) && t.includes(`${SENT_A}_M3`) && t.includes("Administrado") && t.includes("Pulado") && t.includes(`${SENT_A}_DOSE`), "3 medicamentos, 2 doses");
    ok("inativo entra com Situação: Inativo e sem data_fim deslocada", t.includes("Situação: Inativo") && t.includes("Período: de 15/08/2026 até 01/09/2026") && t.includes("Período: de 01/03/2026, sem data de término"), "datas sem deslocar o dia");
    ok("saúde: '120/80 mmHg' e '36,6 °C' formatados em pt-BR", t.includes("120/80 mmHg") && t.includes("36,6 °C"), "valores formatados");
    ok("datetime em America/Sao_Paulo: dose de 14/09 12:30Z sai 09:30", t.includes("14/09/2026 09:30, Administrado"), "UTC-3");
    ok("rodapé 'Página 1 de 1'", t.includes("Página 1 de 1") && textoIdoso.paginas === 1, `${textoIdoso.paginas} página(s)`);
    ok("familiar aprovado (modo_decisao NULL): mesmo conteúdo do idoso", doFamiliar.status === 200 && semGeradoEm(textoFamiliar.texto) === semGeradoEm(t), `status ${doFamiliar.status}`);
    ok("cuidador aprovado sem nenhuma flag: mesmo conteúdo do idoso", doCuidador.status === 200 && semGeradoEm(textoCuidador.texto) === semGeradoEm(t), `status ${doCuidador.status}`);
    ok("vínculo pendente = 403", p1.status === 403 && !String(p1.headers["content-type"]).includes("pdf"), `status ${p1.status}`);
    ok("vínculo recusado = 403", p2.status === 403, `status ${p2.status}`);
    ok("familiar só do A pedindo o idoso B = 403 sem dado do B", cruzado.status === 403 && !JSON.stringify(cruzado.body).includes(SENT_B), `status ${cruzado.status}`);
    ok("PDF do A não contém nada do B (controle positivo: o do B contém)", !t.includes(SENT_B) && !textoFamiliar.texto.includes(SENT_B) && !textoCuidador.texto.includes(SENT_B) && textoIdosoB.texto.includes(`${SENT_B}_M`) && textoIdosoB.texto.includes("777,77/666,66 mmHg"), "sem sentinela do B");
    ok("PDF do B contém só dados do B", !textoIdosoB.texto.includes(SENT_A), "sem sentinela do A");
    ok("sem token = 401 e idosoId inválido = 400", semToken.status === 401 && idCurto.status === 400, `${semToken.status} e ${idCurto.status}`);
    ok("sentinelas nunca aparecem em stdout nem stderr", !saida.replace(`CONTROLE_${tag}`, "").includes("SENT_VERIFY_"), `${saida.length - `CONTROLE_${tag}`.length} byte(s) escritos além do controle`);
    const apos = await contagens();
    ok("leitura não escreve: COUNT(*) de Medicamento, Dose e RegistroSaude iguais antes e depois", apos.med === seeded.med && apos.dose === seeded.dose && apos.reg === seeded.reg, `med ${seeded.med}->${apos.med}, dose ${seeded.dose}->${apos.dose}, reg ${seeded.reg}->${apos.reg}`);
  } finally {
    // Só linhas com a sentinela desta execução. Ordem de FK: doses, registros, vínculos, medicamentos, contas.
    const doTeste = { startsWith: `verify-pdf-${tag}` };
    const contasTeste = (await prisma.usuario.findMany({ where: { firebase_uid: doTeste }, select: { id: true } })).map((u) => u.id);
    const medsTeste = { OR: [{ nome: { startsWith: SENT_A } }, { nome: { startsWith: SENT_B } }, { idoso_id: { in: contasTeste } }] };
    const idsMedsTeste = (await prisma.medicamento.findMany({ where: medsTeste, select: { id: true } })).map((m) => m.id);
    await prisma.registroDoseMedicamento.deleteMany({ where: { OR: [{ medicamento_id: { in: idsMedsTeste } }, { registrado_por_id: { in: contasTeste } }] } });
    await prisma.registroSaude.deleteMany({ where: { OR: [{ idoso_id: { in: contasTeste } }, { registrado_por_id: { in: contasTeste } }] } });
    await prisma.vinculo.deleteMany({ where: { OR: [{ idoso_id: { in: contasTeste } }, { vinculado_id: { in: contasTeste } }] } });
    await prisma.medicamento.deleteMany({ where: { id: { in: idsMedsTeste } } });
    await prisma.usuario.deleteMany({ where: { id: { in: contasTeste } } });
    const depois = await contagens();
    const iguais = depois.med === antes.med && depois.dose === antes.dose && depois.reg === antes.reg;
    ok("COUNT(*) depois da limpeza = antes (as três tabelas)", iguais, `med ${antes.med}->${depois.med}, dose ${antes.dose}->${depois.dose}, reg ${antes.reg}->${depois.reg}`);
    const sobras = await prisma.usuario.count({ where: { firebase_uid: doTeste } });
    ok("nenhuma conta de teste sobrou", sobras === 0, `${sobras} sobra(s)`);
    if (!iguais || sobras !== 0) {
      // Falha alta: lista o que sobrou (só ids e tabela, nunca valores).
      const meds = await prisma.medicamento.findMany({ where: { OR: [{ nome: { startsWith: SENT_A } }, { nome: { startsWith: SENT_B } }] }, select: { id: true } });
      const contas = await prisma.usuario.findMany({ where: { firebase_uid: doTeste }, select: { id: true } });
      console.error(`FALHA: a limpeza deixou resíduo. Medicamento sentinela: [${meds.map((m) => m.id).join(",")}]; contas sentinela: [${contas.map((c) => c.id).join(",")}]; Medicamento ${antes.med}->${depois.med}, Dose ${antes.dose}->${depois.dose}, RegistroSaude ${antes.reg}->${depois.reg}.`);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }

  console.log("\nCenário".padEnd(86) + "Resultado");
  console.log("-".repeat(110));
  for (const r of results) console.log(r.name.padEnd(86) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Erro fatal no script de verificação:", (e as Error).message.replace(/\s+/g, " ").slice(0, 300));
  process.exitCode = 1;
});
