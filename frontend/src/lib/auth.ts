import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  type User,
} from "firebase/auth";
import { app } from "./firebase";

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

// Cadastro
export async function registerUser(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

// Login
export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Login com Google
export async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Logout
export async function logoutUser() {
  return signOut(auth);
}

// Recuperação de senha — dispara o e-mail de reset do Firebase Auth
export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

// Observa mudanças de estado (usuário logou/deslogou)
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Pega o ID Token pra mandar nas requisições ao backend.
// forceRefresh=true busca um token novo no Firebase em vez do cache local —
// necessário depois de confirmar e-mail, pra email_verified vir atualizado (ver
// ConfirmarEmail.tsx, RF-025).
export async function getCurrentUserToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

// Envia o e-mail de verificação do Firebase Auth (RF-025) — usado no cadastro de
// Familiar pra permitir vínculo automático com Idoso já confirmado por posse do e-mail.
// Devolve true quando o e-mail foi de fato enviado (false = nada a confirmar).
export async function sendEmailVerification(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.emailVerified) return false; // contas Google já chegam verificadas
  await firebaseSendEmailVerification(user, {
    url: `${window.location.origin}/confirmar-email`,
  });
  return true;
}

export type TipoPerfil = "idoso" | "cuidador" | "familiar";

// Sincroniza com o backend logo após login/cadastro (POST /auth/sync).
// tipo_perfil e nome só são obrigatórios no backend quando a conta ainda não existe.
// Backend no Render free tier hiberna após inatividade: primeiro request após
// hibernação sofre cold start e pode retornar 500 (timeout de conexão com o
// banco) antes do backend acordar de vez — retry com backoff cobre essa janela
// sem expor o erro transitório como se fosse e-mail/senha errados.
const SYNC_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 8000];

// Erro de /auth/sync com status e corpo estruturados (codigo/proximo_passo vêm dos 409 de
// conflito de e-mail, item 3.2) — as mensagens de login/cadastro ramificam por estes
// campos, não por substring da mensagem.
export class SyncError extends Error {
  status: number
  codigo?: string
  proximoPasso?: string

  constructor(status: number, message: string, codigo?: string, proximoPasso?: string) {
    super(message)
    this.name = 'SyncError'
    this.status = status
    this.codigo = codigo
    this.proximoPasso = proximoPasso
  }
}

export async function syncUser(dados?: {
  tipoPerfil?: TipoPerfil;
  nome?: string;
  emailConviteFamiliar?: string;
}) {
  const token = await getCurrentUserToken();

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa <= SYNC_RETRY_DELAYS_MS.length; tentativa++) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo_perfil: dados?.tipoPerfil,
          nome: dados?.nome,
          email_convite_familiar: dados?.emailConviteFamiliar || undefined,
        }),
      });

      if (!res.ok) {
        let corpo: { error?: unknown; codigo?: unknown; proximo_passo?: unknown } | null = null;
        try {
          corpo = await res.json();
        } catch {
          // corpo ausente ou não-JSON: segue só com o status
        }
        const erro = new SyncError(
          res.status,
          typeof corpo?.error === "string" ? corpo.error : `Falha em /auth/sync: status ${res.status}`,
          typeof corpo?.codigo === "string" ? corpo.codigo : undefined,
          typeof corpo?.proximo_passo === "string" ? corpo.proximo_passo : undefined
        );
        // 4xx é erro real (token inválido, dado inválido) — não adianta tentar de novo.
        if (res.status < 500 || tentativa === SYNC_RETRY_DELAYS_MS.length) {
          throw erro;
        }
        ultimoErro = erro;
        await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAYS_MS[tentativa]));
        continue;
      }

      return await res.json();
    } catch (err) {
      // TypeError = falha de rede/CORS (backend ainda nem respondendo) — também retry.
      if (!(err instanceof TypeError) || tentativa === SYNC_RETRY_DELAYS_MS.length) {
        throw err;
      }
      ultimoErro = err;
      await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAYS_MS[tentativa]));
    }
  }
  throw ultimoErro;
}

// Diferencia "senha/e-mail errados" (erro do Firebase Auth) de "/auth/sync falhou
// mesmo depois do login funcionar". Por SyncError.status: 5xx = backend hibernado no
// Render demorando pra acordar; 4xx com codigo = conflito com orientação própria (409
// de e-mail, item 3.2); 4xx sem codigo = erro real de sync, sem culpar o servidor.
function mensagemSyncError(err: unknown, mensagem5xx: string): string | null {
  if (!(err instanceof SyncError)) return null;
  if (err.codigo && err.proximoPasso) return `${err.message} ${err.proximoPasso}`;
  if (err.status >= 500) return mensagem5xx;
  return "Falha ao sincronizar sua conta com o servidor. Confira os dados e tente novamente.";
}

export function mensagemErroLogin(err: unknown): string {
  return (
    mensagemSyncError(
      err,
      "Login validado, mas o servidor está iniciando. Aguarde alguns segundos e tente de novo."
    ) ?? "Não foi possível entrar. Confira seu e-mail e senha."
  );
}

// Mesma ideia que mensagemErroLogin: se registerUser/loginWithGoogle já criou a
// conta e só o /auth/sync falhou (servidor iniciando), reenviar o formulário bate
// em "e-mail já cadastrado" no Firebase — orientar login em vez de tentar cadastrar
// de novo.
export function mensagemErroCadastro(err: unknown): string {
  return (
    mensagemSyncError(
      err,
      "Conta criada, mas o servidor está iniciando. Aguarde alguns segundos e faça login normalmente (não tente cadastrar de novo)."
    ) ??
    mensagemErroFirebaseCadastro(err) ??
    "Não foi possível criar a conta. Confira os dados e tente novamente."
  );
}

// Erros do Firebase Auth no cadastro que o usuário consegue resolver sozinho.
function mensagemErroFirebaseCadastro(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "Já existe uma conta com este e-mail. Entre com ela ou, se esqueceu a senha, use \"Esqueci minha senha\".";
    case "auth/weak-password":
      return "Senha muito fraca. Use pelo menos 6 caracteres.";
    case "auth/invalid-email":
      return "E-mail inválido. Confira se digitou corretamente.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
    case "auth/popup-closed-by-user":
      return "A janela do Google foi fechada antes de terminar. Tente de novo.";
    default:
      return null;
  }
}
