import { getCurrentUserToken } from "../lib/auth";

// Estrutura dos dados retornados pela API
export interface DadosUsuario {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo_perfil: string;
}

// Busca os dados do usuário autenticado
export async function buscarPerfil(): Promise<DadosUsuario> {
  const token = await getCurrentUserToken();

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/usuario/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Falha ao buscar perfil: status ${res.status}`
    );
  }

  return res.json();
}

// Salva as alterações realizadas no perfil
export async function salvarPerfil(dados: {
  nome: string;
  email: string;
  telefone: string;
}) {
  const token = await getCurrentUserToken();

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/usuario/me`,
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(dados),
    }
  );

  if (!res.ok) {
    const corpo = await res
      .json()
      .catch(() => null);

    throw new Error(
      corpo?.error ??
        `Falha ao salvar perfil: status ${res.status}`
    );
  }

  return res.json() as Promise<DadosUsuario>;
}

// Busca só a foto atual (data URI ou null); GET /usuario/me não carrega mais esse payload
export async function buscarFotoPerfil() {
  const token = await getCurrentUserToken();

  const res = await fetch(`${import.meta.env.VITE_API_URL}/usuario/me/foto`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Falha ao buscar foto de perfil: status ${res.status}`);
  }

  const json = await res.json();
  return (json?.foto_perfil_url ?? null) as string | null;
}

async function chamarFoto(metodo: "POST" | "DELETE", corpo?: FormData) {
  const token = await getCurrentUserToken();

  // Sem Content-Type manual: o browser define o multipart com o boundary.
  const res = await fetch(`${import.meta.env.VITE_API_URL}/usuario/me/foto`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` },
    body: corpo,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error ?? `Falha na foto de perfil: status ${res.status}`);
  }

  return (json?.foto_perfil_url ?? null) as string | null;
}

// Envia a foto (JPEG/PNG até 2 MB) e devolve a data URI salva
export function enviarFotoPerfil(arquivo: File) {
  const form = new FormData();
  form.append("foto", arquivo);
  return chamarFoto("POST", form);
}

// Remove a foto (idempotente); devolve sempre null
export function removerFotoPerfil() {
  return chamarFoto("DELETE");
}
