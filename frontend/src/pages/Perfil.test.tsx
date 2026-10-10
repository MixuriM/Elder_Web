import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";
import Perfil from "./Perfil";
import { FOTO_ACCEPT } from "../lib/prepararFoto";
import { FotoPerfilContext, useFotoPerfil } from "../contexts/useFotoPerfil";
import { AcessoContext } from "../contexts/useAcesso";

// A seção de e-mail tem teste próprio (SituacaoEmail.test.tsx); aqui só importa onde ela aparece.
jest.mock("../components/perfil/SituacaoEmail", () => () => <p>secao-situacao-email</p>);

// O contexto de foto importa useAuthUser (Firebase); o teste não precisa dele.
jest.mock("../hooks/useAuthUser", () => ({
  useAuthUser: () => ({ usuario: null, carregando: false }),
}));

const mockBuscarPerfil = jest.fn();
const mockSalvarPerfil = jest.fn();
const mockEnviarFoto = jest.fn();
const mockRemoverFoto = jest.fn();
// prepararFoto usa canvas (ausente no jsdom) e tem teste próprio (lib/prepararFoto.test.ts).
const mockPreparar = jest.fn();
jest.mock("../lib/prepararFoto", () => ({
  ...jest.requireActual("../lib/prepararFoto"),
  prepararFoto: (...args: unknown[]) => mockPreparar(...args),
}));
jest.mock("../services/perfilService", () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
  salvarPerfil: (...args: unknown[]) => mockSalvarPerfil(...args),
  enviarFotoPerfil: (...args: unknown[]) => mockEnviarFoto(...args),
  removerFotoPerfil: (...args: unknown[]) => mockRemoverFoto(...args),
}));

function renderPerfil() {
  return render(
    <MemoryRouter>
      <Perfil />
    </MemoryRouter>
  );
}

const DADOS = { id: 1, nome: "Ana", email: "ana@a.com", telefone: "123", tipo_perfil: "idoso" };

describe("Perfil", () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset();
    mockSalvarPerfil.mockReset();
    mockEnviarFoto.mockReset();
    mockRemoverFoto.mockReset();
    mockPreparar.mockReset().mockImplementation(async (f: File) => f);
  });

  it("mostra 'Carregando...' antes de buscarPerfil resolver", async () => {
    let resolver!: (v: typeof DADOS) => void;
    mockBuscarPerfil.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );
    renderPerfil();

    expect(screen.getByText("Carregando...")).toBeInTheDocument();

    resolver(DADOS);
    await waitFor(() => expect(screen.queryByText("Carregando...")).not.toBeInTheDocument());
  });

  it("preenche os campos com os dados retornados por buscarPerfil", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    renderPerfil();

    expect(await screen.findByLabelText(/nome/i)).toHaveValue("Ana");
    expect(screen.getByLabelText(/^e-mail$/i)).toHaveValue("ana@a.com");
    expect(screen.getByLabelText(/telefone/i)).toHaveValue("123");
  });

  it("buscarPerfil falha: mostra erro, não quebra a página", async () => {
    mockBuscarPerfil.mockRejectedValue(new Error("rede fora"));
    renderPerfil();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
  });

  it("salva alterações com sucesso: chama salvarPerfil e mostra mensagem de sucesso", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    mockSalvarPerfil.mockResolvedValue({ ...DADOS, nome: "Ana Silva" });
    const user = userEvent.setup();
    renderPerfil();

    const campoNome = await screen.findByLabelText(/nome/i);
    await user.clear(campoNome);
    await user.type(campoNome, "Ana Silva");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() =>
      expect(mockSalvarPerfil).toHaveBeenCalledWith({ nome: "Ana Silva", email: "ana@a.com", telefone: "123" })
    );
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("falha ao salvar: mostra a mensagem de erro retornada", async () => {
    mockBuscarPerfil.mockResolvedValue(DADOS);
    mockSalvarPerfil.mockRejectedValue(new Error("Este e-mail já está em uso por outra conta."));
    const user = userEvent.setup();
    renderPerfil();

    await screen.findByLabelText(/nome/i);
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/já está em uso/i);
  });

  describe("foto de perfil", () => {
    const FOTO = "data:image/jpeg;base64,QUJD";

    // Provider com estado real, pra checar a sincronização com o contexto (Header).
    function ProviderReal({ children, inicial = null }: { children: ReactNode; inicial?: string | null }) {
      const [fotoPerfilUrl, definirFotoPerfil] = useState<string | null>(inicial);
      return (
        <FotoPerfilContext.Provider value={{ fotoPerfilUrl, carregandoFoto: false, definirFotoPerfil }}>
          {children}
          <span data-testid="contexto">{fotoPerfilUrl ?? "sem-foto"}</span>
        </FotoPerfilContext.Provider>
      );
    }

    function renderComProvider(inicial: string | null = null) {
      return render(
        <MemoryRouter>
          <ProviderReal inicial={inicial}>
            <Perfil />
          </ProviderReal>
        </MemoryRouter>
      );
    }

    const arquivo = () => new File(["abc"], "eu.jpg", { type: "image/jpeg" });

    it("sem foto: não mostra 'Remover foto de perfil'", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      expect(screen.queryByRole("button", { name: /remover foto/i })).not.toBeInTheDocument();
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
    });

    it("com foto: mostra a imagem e o botão de remover; a foto vem do contexto", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      renderComProvider(FOTO);

      expect(await screen.findByRole("button", { name: /remover foto/i })).toBeInTheDocument();
      expect(screen.getByAltText("Foto de perfil")).toHaveAttribute("src", FOTO);
      expect(screen.getByTestId("contexto")).toHaveTextContent(FOTO);
    });

    it("upload com sucesso: prepara a foto, envia a versão preparada, atualiza contexto e mostra feedback", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockEnviarFoto.mockResolvedValue(FOTO);
      const pronta = new File(["webp"], "eu.webp", { type: "image/webp" });
      mockPreparar.mockResolvedValue(pronta);
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      const arq = arquivo();
      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arq);

      // toBe, não toHaveBeenCalledWith: dois File sem propriedades próprias são "iguais" no equals do Jest.
      await waitFor(() => expect(mockEnviarFoto).toHaveBeenCalledTimes(1));
      expect(mockEnviarFoto.mock.calls[0][0]).toBe(pronta);
      expect(mockPreparar.mock.calls[0][0]).toBe(arq);
      expect(await screen.findByRole("status")).toHaveTextContent(/foto de perfil atualizada/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent(FOTO);
      expect(screen.getByRole("button", { name: /remover foto/i })).toBeInTheDocument();
    });

    it("upload recusado pelo servidor: mostra a mensagem em role=alert e mantém sem foto", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockEnviarFoto.mockRejectedValue(new Error("Foto acima do limite de 15 MB. Escolha uma foto menor."));
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arquivo());

      expect(await screen.findByRole("alert")).toHaveTextContent(/limite de 15 MB/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
    });

    it("enquanto prepara: anuncia 'Preparando a foto' em role=status e desabilita os botões da foto", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      let concluir!: (f: File) => void;
      mockPreparar.mockReturnValue(new Promise<File>((r) => (concluir = r)));
      mockEnviarFoto.mockResolvedValue(FOTO);
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arquivo());

      expect(await screen.findByRole("status")).toHaveTextContent("Preparando a foto, aguarde.");
      expect(screen.getByRole("button", { name: "Alterar foto de perfil" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Adicionar foto" })).toBeDisabled();
      expect(mockEnviarFoto).not.toHaveBeenCalled();

      concluir(arquivo());
      expect(await screen.findByText(/foto de perfil atualizada/i)).toBeInTheDocument();
      expect(screen.queryByText(/preparando a foto/i)).not.toBeInTheDocument();
    });

    it("falha ao preparar: mostra a mensagem em role=alert e não envia nada", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockPreparar.mockRejectedValue(
        new Error("Não foi possível preparar esta foto. Tente outra foto ou escolha uma em JPEG ou PNG."),
      );
      const user = userEvent.setup();
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      await user.upload(screen.getByLabelText(/escolher foto de perfil/i), arquivo());

      expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível preparar esta foto/i);
      expect(mockEnviarFoto).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Adicionar foto" })).toBeEnabled();
    });

    it("textos e accept refletem o novo limite: sem menção a 2 MB, nem a JPEG ou PNG só", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      renderComProvider();
      await screen.findByLabelText(/nome/i);

      expect(screen.queryByText(/2 MB/)).not.toBeInTheDocument();
      expect(screen.getByText("Formatos comuns de foto, até 15 MB.")).toBeInTheDocument();
      const input = screen.getByLabelText("Escolher foto de perfil (formatos comuns de foto, até 15 MB)");
      expect(input).toHaveAttribute("accept", FOTO_ACCEPT);
    });

    it("remover: chama removerFotoPerfil, zera o contexto e esconde o botão", async () => {
      mockBuscarPerfil.mockResolvedValue(DADOS);
      mockRemoverFoto.mockResolvedValue(null);
      const user = userEvent.setup();
      renderComProvider(FOTO);

      await user.click(await screen.findByRole("button", { name: /remover foto/i }));

      await waitFor(() => expect(mockRemoverFoto).toHaveBeenCalled());
      expect(await screen.findByRole("status")).toHaveTextContent(/foto de perfil removida/i);
      expect(screen.getByTestId("contexto")).toHaveTextContent("sem-foto");
      expect(screen.queryByRole("button", { name: /remover foto/i })).not.toBeInTheDocument();
    });

    it("useFotoPerfil sem Provider devolve 'sem foto'", () => {
      function Sonda() {
        return <span>{useFotoPerfil().fotoPerfilUrl ?? "nada"}</span>;
      }
      render(<Sonda />);
      expect(screen.getByText("nada")).toBeInTheDocument();
    });
  });
});

describe("Perfil: situação do e-mail só para cuidador e familiar", () => {
  beforeEach(() => mockBuscarPerfil.mockReset().mockResolvedValue(DADOS));

  it.each([
    ["cuidador", true],
    ["familiar", true],
    ["idoso", false],
    [null, false],
  ])("%s: seção %s", async (tipoPerfil, aparece) => {
    render(
      <MemoryRouter>
        <AcessoContext.Provider value={{ tipoPerfil, estado: "ok", temVinculoAprovado: false, temVinculoPendente: false }}>
          <Perfil />
        </AcessoContext.Provider>
      </MemoryRouter>
    );
    await screen.findByDisplayValue("Ana");
    expect(screen.queryByText("secao-situacao-email") !== null).toBe(aparece);
  });
});
