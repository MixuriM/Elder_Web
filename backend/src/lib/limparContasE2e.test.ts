import { TETO_POR_EXECUCAO, ehContaE2e, limparContasE2e, type AdminLimpeza } from "./limparContasE2e";

// Limpeza das contas e2e do Firebase (fechamento do 9.5, F6). Admin SDK SEMPRE mockado: nenhuma chamada ao Firebase real.
// E-mails e uids FICTÍCIOS, só para teste.

const e2e = (n: number) => ({ uid: `u${n}`, email: `e2e-idoso-${n}@e2e.elderweb.test` });

// Admin falso com páginas de 1000 (como o listUsers real) e registro de tudo que for apagado.
function adminCom(usuarios: { uid: string; email?: string }[], opcoes: { falhasPorLote?: number } = {}) {
  const apagados: string[] = [];
  const listUsers = jest.fn(async (_max?: number, token?: string) => {
    const inicio = token ? Number(token) : 0;
    const fim = inicio + 1000;
    return { users: usuarios.slice(inicio, fim), pageToken: fim < usuarios.length ? String(fim) : undefined };
  });
  const deleteUsers = jest.fn(async (uids: string[]) => {
    apagados.push(...uids);
    return { successCount: uids.length - (opcoes.falhasPorLote ?? 0), failureCount: opcoes.falhasPorLote ?? 0, errors: [] };
  });
  const admin: AdminLimpeza = { listUsers, deleteUsers };
  return { admin, listUsers, deleteUsers, apagados };
}

describe("ehContaE2e", () => {
  it.each([
    ["e2e-idoso-123@e2e.elderweb.test", true],
    ["e2e-familiar-exclusao-1792499196546@e2e.elderweb.test", true],
    ["e2e-x@gmail.com", false],
    ["x@e2e.elderweb.test", false],
    ["pessoa.real.longa@e2e.elderweb.test", false], // domínio de teste sem o prefixo e2e-
    ["suporte-e2e-1@e2e.elderweb.test", false], // e2e- no meio não vale

    ["e2e-x@e2e.elderweb.test.evil.com", false],
    ["e2e-x@outro.e2e.elderweb.test", false],
    ["E2E-X@E2E.ELDERWEB.TEST", false], // o Firebase guarda em minúsculas; maiúscula não é conta criada pelos e2e
    ["e2e-@e2e.elderweb.test", false],
    ["", false],
    [undefined, false],
    [null, false],
    [42, false],
  ])("ehContaE2e(%p) = %s", (email, esperado) => {
    expect(ehContaE2e(email)).toBe(esperado);
  });
});

describe("limparContasE2e", () => {
  it("simulação (padrão): conta quantas seriam apagadas e NÃO chama deleteUsers", async () => {
    const { admin, deleteUsers } = adminCom([e2e(1), e2e(2), { uid: "real", email: "pessoa@exemplo.test" }]);
    const r = await limparContasE2e(admin, { apagar: false });
    expect(r).toEqual({ simulacao: true, encontradas: 2, apagadas: 0, falhas: 0, limitadoPeloTeto: false });
    expect(deleteUsers).not.toHaveBeenCalled();
  });

  it("com apagar: remove SOMENTE o padrão exato, mesmo que a lista traga outros", async () => {
    const outros = [
      { uid: "g", email: "e2e-x@gmail.com" },
      { uid: "d", email: "x@e2e.elderweb.test" },
      { uid: "s" }, // sem e-mail (telefone)
      { uid: "demo", email: "idosa-helena@demo.elderweb.test" },
      { uid: "m", email: "e2e-x@e2e.elderweb.test.evil.com" },
    ];
    const { admin, apagados } = adminCom([e2e(1), ...outros, e2e(2)]);
    const r = await limparContasE2e(admin, { apagar: true });
    expect(r).toMatchObject({ simulacao: false, encontradas: 2, apagadas: 2, falhas: 0 });
    expect(apagados.sort()).toEqual(["u1", "u2"]);
  });

  it("segue pela página seguinte até o fim", async () => {
    const todos = Array.from({ length: 2500 }, (_, i) => (i % 5 === 0 ? e2e(i) : { uid: `r${i}`, email: `r${i}@exemplo.test` }));
    const { admin, listUsers } = adminCom(todos);
    const r = await limparContasE2e(admin, { apagar: false });
    expect(r.encontradas).toBe(500);
    expect(listUsers).toHaveBeenCalledTimes(3);
    expect(listUsers.mock.calls.map((c) => c[1])).toEqual([undefined, "1000", "2000"]);
  });

  it("teto de 500 por execução: apaga 500, diz que parou no teto e não toca no resto", async () => {
    const { admin, deleteUsers, apagados } = adminCom(Array.from({ length: 700 }, (_, i) => e2e(i)));
    const r = await limparContasE2e(admin, { apagar: true });
    expect(TETO_POR_EXECUCAO).toBe(500);
    expect(r).toMatchObject({ encontradas: 700, apagadas: 500, limitadoPeloTeto: true });
    expect(apagados).toHaveLength(500);
    expect(new Set(apagados).size).toBe(500);
    for (const chamada of deleteUsers.mock.calls) expect(chamada[0].length).toBeLessThanOrEqual(100);
  });

  it("a simulação também avisa do teto", async () => {
    const { admin } = adminCom(Array.from({ length: 700 }, (_, i) => e2e(i)));
    expect(await limparContasE2e(admin, { apagar: false })).toMatchObject({ encontradas: 700, limitadoPeloTeto: true, apagadas: 0 });
  });

  it("conta as falhas do Firebase sem expor erro", async () => {
    const { admin } = adminCom([e2e(1), e2e(2), e2e(3)], { falhasPorLote: 1 });
    expect(await limparContasE2e(admin, { apagar: true })).toMatchObject({ apagadas: 2, falhas: 1 });
  });

  it("erro do Firebase vira mensagem fixa, sem eco do erro original (uid, e-mail ou chave)", async () => {
    const admin: AdminLimpeza = {
      listUsers: jest.fn().mockRejectedValue(Object.assign(new Error("segredo-uid-123 pessoa@exemplo.test chave"), { code: "auth/internal-error" })),
      deleteUsers: jest.fn(),
    };
    const erro = await limparContasE2e(admin, { apagar: true }).catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("Falha ao falar com o Firebase. Nada foi apagado ou a limpeza ficou pela metade; rode de novo em modo simulação.");
    expect((erro as Error).message).not.toMatch(/segredo|exemplo|chave/);
  });

  it("erro ao apagar um lote também vira mensagem fixa", async () => {
    const admin: AdminLimpeza = {
      listUsers: jest.fn().mockResolvedValue({ users: [e2e(1)], pageToken: undefined }),
      deleteUsers: jest.fn().mockRejectedValue(new Error("segredo-uid-123")),
    };
    const erro = await limparContasE2e(admin, { apagar: true }).catch((e: Error) => e);
    expect((erro as Error).message).not.toMatch(/segredo/);
    expect((erro as Error).message).toMatch(/^Falha ao falar com o Firebase/);
  });
});
