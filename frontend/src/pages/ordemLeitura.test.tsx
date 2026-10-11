import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import Login from "./Login";
import Cadastro from "./Cadastro";
import EsqueciSenha from "./EsqueciSenha";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
}));
jest.mock("../lib/firebase", () => ({ app: {} }));

// No celular o formulário vem antes do bloco informativo. A ordem do DOM (leitura e foco) tem de ser a mesma da tela:
// o Voltar primeiro (canto superior esquerdo), depois o formulário, e o bloco informativo por último, sem nada focável.
const FOCAVEL = 'button, a[href], input:not([type="hidden"]), select, textarea';

const telas: [string, ReactElement, string][] = [
  ["Login", <Login key="l" />, "Que bom ter você de volta!"],
  ["Cadastro", <Cadastro key="c" />, "Comece com o Elder"],
  ["EsqueciSenha", <EsqueciSenha key="e" />, "Que bom ter você de volta!"],
];

describe.each(telas)("%s: ordem de leitura e de foco", (_nome, tela, textoInformativo) => {
  function montar() {
    const { container } = render(<MemoryRouter>{tela}</MemoryRouter>);
    const informativo = screen.getByText(textoInformativo).closest("section") as HTMLElement;
    const formulario = container.querySelector("form") as HTMLFormElement;
    return { container, informativo, formulario };
  }

  it("formulário antes do bloco informativo no DOM", () => {
    const { informativo, formulario } = montar();
    expect(formulario.compareDocumentPosition(informativo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Voltar é o primeiro focável e o bloco informativo não tem nada focável", () => {
    const { container, informativo } = montar();
    expect(container.querySelector(FOCAVEL)).toBe(screen.getByRole("button", { name: "Voltar para a tela de boas-vindas" }));
    expect(informativo.querySelector(FOCAVEL)).toBeNull();
  });
});
