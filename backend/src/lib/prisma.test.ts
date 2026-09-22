const queryMock = jest.fn();

// PrismaClient real é caro (abre conexão na primeira query) e não é o alvo deste
// teste — o alvo é só o retry em $allOperations. Fake mínimo: $extends recebe a
// mesma config que lib/prisma.ts monta e expõe um método que invoca
// $allOperations com um `query` controlado pelo teste, como o Prisma real faria
// por baixo dos panos.
class FakePrismaClient {
  $extends(config: {
    query: { $allOperations: (params: { args: unknown; query: typeof queryMock }) => Promise<unknown> };
  }) {
    const allOperations = config.query.$allOperations;
    return {
      usuario: {
        findFirst: (args: unknown) => allOperations({ args, query: queryMock }),
      },
    };
  }
}

jest.mock("@prisma/client", () => {
  const actual = jest.requireActual("@prisma/client");
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => new FakePrismaClient()),
  };
});

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

function erroDeInicializacao(mensagem: string) {
  return new Prisma.PrismaClientInitializationError(mensagem, "5.22.0");
}

describe("prisma — retry com backoff (lib/prisma.ts)", () => {
  beforeEach(() => {
    queryMock.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sucesso na primeira tentativa: não espera nem repete", async () => {
    queryMock.mockResolvedValue({ id: 1 });

    const resultado = await prisma.usuario.findFirst({});

    expect(resultado).toEqual({ id: 1 });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("falha 2 vezes com PrismaClientInitializationError e depois responde", async () => {
    queryMock
      .mockRejectedValueOnce(erroDeInicializacao("indisponível 1"))
      .mockRejectedValueOnce(erroDeInicializacao("indisponível 2"))
      .mockResolvedValueOnce({ id: 2 });

    const promessa = prisma.usuario.findFirst({});
    // 2 retries consumidos: delays de 1000ms e 2000ms (RETRY_DELAYS_MS[0], [1]).
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    const resultado = await promessa;

    expect(resultado).toEqual({ id: 2 });
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("desiste depois da última tentativa (6 retries) e propaga o erro", async () => {
    queryMock.mockRejectedValue(erroDeInicializacao("sempre indisponível"));

    const promessa = prisma.usuario.findFirst({});
    promessa.catch(() => {}); // evita unhandledRejection antes do assert abaixo

    // 6 delays: 1000+2000+4000+8000+8000+8000 = 31000ms de margem total.
    await jest.advanceTimersByTimeAsync(31000);

    await expect(promessa).rejects.toThrow("sempre indisponível");
    expect(queryMock).toHaveBeenCalledTimes(7); // 1 tentativa inicial + 6 retries
  });

  it("erro que não é PrismaClientInitializationError passa direto, sem retry", async () => {
    queryMock.mockRejectedValue(new Error("erro de query comum, não de conexão"));

    await expect(prisma.usuario.findFirst({})).rejects.toThrow("erro de query comum");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
