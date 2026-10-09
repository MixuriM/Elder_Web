// Único ponto que conhece o provedor de e-mail transacional (hoje a API HTTPS da Brevo; o Render free bloqueia
// SMTP). Trocar de provedor = mudar só este arquivo. fetch nativo do Node 24, sem SDK.
// Nunca lê o corpo da resposta (pode ecoar o destinatário) e nunca coloca chave, destinatário ou texto no erro:
// quem chama só recebe um código fixo (SEM_CONFIGURACAO, TIMEOUT, REDE ou HTTP_<status>).
// Sem retry: quem chama decide o que fazer com a falha.
const URL_API = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 8_000;

export class ErroEnvioEmail extends Error {
  constructor(readonly codigo: string) {
    super(`Falha no envio de e-mail (${codigo}).`);
    this.name = "ErroEnvioEmail";
  }
}

// Lida a cada chamada (não no import): sem as variáveis, só o envio falha, o resto do app sobe normal.
export function configuracaoEmail(): { chave: string; endereco: string; nome: string } | null {
  const chave = process.env.EMAIL_API_KEY?.trim();
  const endereco = process.env.EMAIL_REMETENTE_ENDERECO?.trim();
  if (!chave || !endereco) return null;
  return { chave, endereco, nome: process.env.EMAIL_REMETENTE_NOME?.trim() || "Elder Web" };
}

export async function enviarEmail(msg: { para: string; assunto: string; texto: string }): Promise<void> {
  const config = configuracaoEmail();
  if (!config) throw new ErroEnvioEmail("SEM_CONFIGURACAO");

  let resposta: Response;
  try {
    resposta = await fetch(URL_API, {
      method: "POST",
      headers: { "api-key": config.chave, "content-type": "application/json", accept: "application/json" },
      // Texto puro (textContent): nada do conteúdo é interpretado como HTML.
      body: JSON.stringify({
        sender: { name: config.nome, email: config.endereco },
        to: [{ email: msg.para }],
        subject: msg.assunto,
        textContent: msg.texto,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
  } catch (e) {
    throw new ErroEnvioEmail(e instanceof Error && e.name === "TimeoutError" ? "TIMEOUT" : "REDE");
  }
  if (!resposta.ok) throw new ErroEnvioEmail(`HTTP_${resposta.status}`);
}
