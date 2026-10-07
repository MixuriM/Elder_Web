// Teste de fumaça do item 9.2 (RNF-002): criptografia em trânsito e em repouso do banco. SOMENTE LEITURA:
// quatro SELECT com SQL literal fixo (sem interpolação). Nunca escreve no banco, nunca cria arquivo e só
// lê DATABASE_URL. Nunca imprime DATABASE_URL, usuário, senha nem mensagem bruta de erro do Prisma:
// só host, flags de transporte, texto fixo por tipo de falha e PASS/FAIL.
//
// Uso (dentro de backend/):
//   npx tsx scripts/smoke-tde-azure.ts                    (avalia a URL; host não local não conecta)
//   npx tsx scripts/smoke-tde-azure.ts --confirmo-azure   (conecta e roda os SELECT; exige autorização do Marcos)
// Local: DATABASE_URL="sqlserver://localhost:14330;..." npx tsx scripts/smoke-tde-azure.ts

import "dotenv/config";
import { avaliarConexaoCifrada, avaliarTde, avaliarUrlBanco, type Avaliacao } from "../src/lib/segurancaTransporte";

type Resultado = { name: string; pass: boolean; detail: string };
const results: Resultado[] = [];
const registrar = (name: string, a: Avaliacao) => results.push({ name, pass: a.ok, detail: a.detalhe });

const HOSTS_LOCAIS = ["localhost", "127.0.0.1", "::1"];

// Texto fixo por tipo de falha; o erro bruto do Prisma nunca sai (pode citar host, usuário e query).
// Só saem: nome da classe do erro, código do Prisma e, em P2010, o número do erro do SQL Server (só dígitos).
function descreverFalha(e: unknown): string {
  const info = (e ?? {}) as { name?: unknown; errorCode?: unknown; code?: unknown; meta?: { code?: unknown } };
  const code = info.errorCode ?? info.code;
  const classe = typeof info.name === "string" && /^[A-Za-z]+$/.test(info.name) ? info.name : "erro";
  const sql = typeof info.meta?.code === "string" && /^\d{1,6}$/.test(info.meta.code) ? `, erro SQL ${info.meta.code}` : "";
  if (code === "P1001") return "servidor inacessível (P1001): firewall, DNS ou servidor fora do ar";
  if (code === "P1000") return "autenticação recusada (P1000)";
  if (code === "P1011") return "falha ao abrir conexão TLS (P1011)";
  if (code === "P1017") return "servidor encerrou a conexão (P1017)";
  return typeof code === "string" ? `falha na consulta (${classe} ${code}${sql})` : `falha na consulta (${classe})`;
}

type Tentativa<T> = { ok: true; valor: T } | { ok: false; motivo: string };
async function tentar<T>(fn: () => Promise<T>): Promise<Tentativa<T>> {
  try {
    return { ok: true, valor: await fn() };
  } catch (e) {
    return { ok: false, motivo: descreverFalha(e) };
  }
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function imprimir() {
  console.log("\n" + "Check".padEnd(45) + "Resultado");
  console.log("-".repeat(100));
  for (const r of results) console.log(r.name.padEnd(45) + (r.pass ? "PASS" : "FAIL") + "  " + r.detail);
  const falhas = results.filter((r) => !r.pass);
  console.log(`\n${results.length - falhas.length}/${results.length} PASS`);
  if (falhas.length > 0) process.exitCode = 1;
}

async function main() {
  const url = avaliarUrlBanco(process.env.DATABASE_URL ?? "");
  console.log(`Host: ${url.host || "(ilegível)"}  encrypt=${url.encrypt}  trustServerCertificate=${url.trustServerCertificate}`);
  registrar("A formato da DATABASE_URL", {
    ok: url.ok,
    detalhe: url.motivos.length > 0 ? url.motivos.join("; ") : "encrypt e certificado coerentes com o host",
  });

  if (!url.host) {
    imprimir();
    return;
  }
  if (!HOSTS_LOCAIS.includes(url.host) && !process.argv.includes("--confirmo-azure")) {
    imprimir();
    console.log("\nConexão NÃO feita: host não local exige --confirmo-azure (autorização explícita do Marcos).");
    process.exitCode = 1;
    return;
  }

  // Import só depois das travas acima. log: [] silencia o stderr padrão do Prisma (erro de conexão cita
  // host) e não registra query nenhuma.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: [] });
  try {
    const motor = await tentar(() => prisma.$queryRaw<{ v: unknown }[]>`SELECT CAST(SERVERPROPERTY('EngineEdition') AS INT) AS v`);
    const banco = await tentar(() => prisma.$queryRaw<{ v: unknown }[]>`SELECT CAST(is_encrypted AS INT) AS v FROM sys.databases WHERE name = DB_NAME()`);
    // Normalmente falha por falta de permissão VIEW DATABASE STATE: vira "indisponível", não derruba o resto.
    const chave = await tentar(() => prisma.$queryRaw<{ encryption_state: unknown; encryptor_type: unknown }[]>`SELECT encryption_state, encryptor_type FROM sys.dm_database_encryption_keys WHERE database_id = DB_ID()`);
    const conexao = await tentar(() => prisma.$queryRaw<{ v: unknown }[]>`SELECT CAST(encrypt_option AS VARCHAR(10)) AS v FROM sys.dm_exec_connections WHERE session_id = @@SPID`);

    registrar(
      "B conexão cifrada (encrypt_option)",
      conexao.ok ? avaliarConexaoCifrada(conexao.valor[0]?.v as string | undefined) : { ok: false, detalhe: conexao.motivo },
    );
    if (!motor.ok || !banco.ok) {
      registrar("C TDE em repouso (Azure SQL Database)", { ok: false, detalhe: !motor.ok ? motor.motivo : (banco as { motivo: string }).motivo });
    } else {
      const linha = chave.ok ? chave.valor[0] : undefined;
      registrar(
        "C TDE em repouso (Azure SQL Database)",
        avaliarTde({
          engineEdition: num(motor.valor[0]?.v),
          isEncrypted: num(banco.valor[0]?.v),
          encryptionState: num(linha?.encryption_state),
          encryptorType: typeof linha?.encryptor_type === "string" ? linha.encryptor_type : null,
        }),
      );
    }
    if (!chave.ok) console.log(`Aviso: sys.dm_database_encryption_keys indisponível (${chave.motivo}); detalhe da chave não verificado.`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  imprimir();
}

main().catch(() => {
  console.error("Erro fatal no smoke (detalhe omitido de propósito).");
  process.exitCode = 1;
});
