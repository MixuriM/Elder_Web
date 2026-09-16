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
export async function sendEmailVerification() {
  const user = auth.currentUser;
  if (!user || user.emailVerified) return; // contas Google já chegam verificadas
  await firebaseSendEmailVerification(user, {
    url: `${window.location.origin}/confirmar-email`,
  });
}

export type TipoPerfil = "idoso" | "cuidador" | "familiar";

// Sincroniza com o backend logo após login/cadastro (POST /auth/sync).
// tipo_perfil e nome só são obrigatórios no backend quando a conta ainda não existe.
export async function syncUser(dados?: {
  tipoPerfil?: TipoPerfil;
  nome?: string;
  emailConviteFamiliar?: string;
}) {
  const token = await getCurrentUserToken();
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
    const corpo = await res.text().catch(() => "");
    throw new Error(
      `Falha em /auth/sync: status ${res.status}${corpo ? ` — ${corpo}` : ""}`
    );
  }

  return res.json();
}