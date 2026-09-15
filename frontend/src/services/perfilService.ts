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