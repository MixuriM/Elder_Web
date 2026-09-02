import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
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

// Observa mudanças de estado (usuário logou/deslogou)
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Pega o ID Token pra mandar nas requisições ao backend
export async function getCurrentUserToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

type TipoPerfil = "idoso" | "cuidador" | "familiar";

// Sincroniza o usuário logado no Firebase com o backend (cria o Usuario no
// primeiro acesso). nome/tipoPerfil só são obrigatórios no fluxo de cadastro —
// o backend rejeita com 400 se faltar e o Usuario ainda não existir.
export async function syncUser(params?: { nome?: string; tipoPerfil?: TipoPerfil }) {
  const token = await getCurrentUserToken();
  if (!token) throw new Error("Nenhum usuário logado.");

  const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // nome só entra se preenchido — em branco, o backend usa o nome do provedor
    // (ex.: conta Google já tem displayName no token).
    body: JSON.stringify({ nome: params?.nome || undefined, tipo_perfil: params?.tipoPerfil }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Falha ao sincronizar usuário.");
  }
  return data as { criado: boolean; usuario: { id: number; tipo_perfil: string; nome: string } };
}