import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExportarHistorico from "./ExportarHistorico";

const mockBaixarPdf = jest.fn();

jest.mock("../../lib/baixarPdf", () => ({
  baixarPdf: (...args: unknown[]) => mockBaixarPdf(...args),
}));

describe("ExportarHistorico", () => {
  beforeEach(() => {
    mockBaixarPdf.mockReset();
    mockBaixarPdf.mockResolvedValue(undefined);
  });

  it.each([
    [undefined, "/historico/pdf"],
    ["7", "/historico/idoso/7/pdf"],
  ])("exporta pelo endpoint correto (idosoId: %s)", async (idosoId, caminho) => {
    render(<ExportarHistorico idosoId={idosoId} />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar histórico" }));

    await waitFor(() => expect(mockBaixarPdf).toHaveBeenCalledWith(caminho));
    expect(await screen.findByRole("status")).toHaveTextContent("PDF gerado. O download começou.");
  });

  it("exibe erro caso o download falhe", async () => {
    mockBaixarPdf.mockRejectedValue(new Error("Sem permissão para exportar histórico."));
    render(<ExportarHistorico />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar histórico" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para exportar histórico.");
  });
});
