// Diagnóstico do envio de e-mail do aviso de emergência: manda UM e-mail real de teste pela mesma configuração do
// lib/enviarEmail.ts (EMAIL_API_KEY, EMAIL_REMETENTE_ENDERECO, EMAIL_REMETENTE_NOME do backend/.env) e imprime só o
// resultado: OK, ou o código do erro. Diferente da lib, aqui o corpo de erro da Brevo é lido e impresso (`code` e
// `message`), porque é para isso que o script serve: dizer POR QUE a Brevo recusou (remetente não validado, IP não
// autorizado, chave inválida). A rota e a lib continuam sem ler o corpo.
//
// Uso (dentro de backend/): npx tsx scripts/testar-email.ts marcospauloesgalhacastelli@gmail.com
// Só aceita esse destino (conta do Marcos). Nunca imprime a chave. Não toca no banco nem no Firebase.
// Saída: 0 = enviado; 1 = a Brevo ou a rede recusou; 2 = argumento errado; 3 = faltam variáveis EMAIL_*;
// 4 = destino não permitido.

import "dotenv/config";

const DESTINO_PERMITIDO = "marcospauloesgalhacastelli@gmail.com";
const URL_API = "https://api.brevo.com/v3/smtp/email";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Uso: npx tsx scripts/testar-email.ts <endereço>");
    return 2;
  }
  const para = args[0].trim();
  if (para.toLowerCase() !== DESTINO_PERMITIDO) {
    console.error(`Destino não permitido. Este script só envia para ${DESTINO_PERMITIDO}.`);
    return 4;
  }

  const faltam = ["EMAIL_API_KEY", "EMAIL_REMETENTE_ENDERECO"].filter((n) => !process.env[n]?.trim());
  if (faltam.length > 0) {
    console.error(`Faltam variáveis no backend/.env: ${faltam.join(", ")}`);
    return 3;
  }
  const chave = process.env.EMAIL_API_KEY!.trim();
  const endereco = process.env.EMAIL_REMETENTE_ENDERECO!.trim();
  const nome = process.env.EMAIL_REMETENTE_NOME?.trim() || "Elder Web";

  let resposta: Response;
  try {
    resposta = await fetch(URL_API, {
      method: "POST",
      headers: { "api-key": chave, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: nome, email: endereco },
        to: [{ email: para }],
        subject: "Teste de envio do Elder Web",
        textContent: "Este é um e-mail de teste do Elder Web (script testar-email). Pode ignorar.",
      }),
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
  } catch (e) {
    console.error(e instanceof Error && e.name === "TimeoutError" ? "TIMEOUT" : "REDE");
    return 1;
  }

  if (resposta.ok) {
    console.log("OK");
    return 0;
  }
  const corpo = (await resposta.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
  console.error(`HTTP_${resposta.status}`, { code: corpo?.code, message: corpo?.message });
  return 1;
}

// exitCode em vez de process.exit: no Windows, process.exit com a conexão do fetch ainda fechando derruba o Node
// com "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" depois do OK.
main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  () => {
    console.error("ERRO_INESPERADO");
    process.exitCode = 1;
  },
);
