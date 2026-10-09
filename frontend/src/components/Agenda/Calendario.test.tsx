import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Calendario from "./Calendario";
import { agruparEventosPorDia, type EventoAgenda } from "../../lib/agendaPorDia";

expect.extend(toHaveNoViolations);

// Calendário da Agenda (visões Mês e Dia). Todos os títulos são FICTÍCIOS, só para teste.
const AGORA = new Date("2026-10-09T15:00:00.000Z"); // sexta-feira, 09/10/2026, 12:00 em São Paulo

function ev(id: number, tipo: string, inicio: string, fim: string | null = null): EventoAgenda {
  return { id, tipo_evento: tipo, titulo: `titulo-falso-${id}`, descricao: null, data_hora_inicio: inicio, data_hora_fim: fim };
}

const EVENTOS = [
  ev(1, "medico", "2026-10-09T13:00:00.000Z", "2026-10-09T14:00:00.000Z"), // 10:00 às 11:00
  ev(2, "pessoal", "2026-10-09T20:00:00.000Z"), // 17:00
  ...[3, 4, 5, 6, 7].map((id) => ev(id, "cuidado", `2026-10-15T1${id}:00:00.000Z`)),
  ev(8, "pessoal", "2026-10-20T01:00:00.000Z", "2026-10-20T04:00:00.000Z"), // 19/10 22:00 até 20/10 01:00
];

function renderCal(eventos = EVENTOS) {
  return render(<Calendario grupos={agruparEventosPorDia(eventos, AGORA)} agora={AGORA} />);
}

const celula = (nome: RegExp) => screen.getByRole("button", { name: nome });

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((q: string) => ({ matches: q.includes("min-width") })) as unknown as typeof window.matchMedia;
});
afterEach(() => jest.restoreAllMocks());

describe("Calendario: visão Mês", () => {
  it("grade do mês atual com cabeçalho dos dias e células de domingo a sábado", () => {
    renderCal();
    const grade = screen.getByRole("grid", { name: "Outubro de 2026" });
    const linhas = within(grade).getAllByRole("row");
    expect(linhas).toHaveLength(6); // cabeçalho + 5 semanas
    const cabecalho = within(linhas[0]).getAllByRole("columnheader");
    expect(cabecalho.map((c) => c.textContent)).toEqual(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]);
    expect(within(grade).getAllByRole("gridcell")).toHaveLength(35);
  });

  it("célula com nome completo, hoje marcado e roving tabindex no dia de hoje", () => {
    renderCal();
    const hoje = celula(/^9 de outubro, hoje, 2 compromissos: 1 pessoal, 1 médico$/);
    expect(hoje).toHaveAttribute("aria-current", "date");
    expect(hoje).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("grid").querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(celula(/^1 de outubro, nenhum compromisso$/)).toHaveAttribute("tabindex", "-1");
  });

  it("no máximo 3 marcas por dia e o resto em +N", () => {
    renderCal();
    const dia15 = celula(/^15 de outubro, 5 compromissos: 5 cuidado$/);
    expect(dia15.querySelectorAll("[data-marca]")).toHaveLength(3);
    expect(dia15).toHaveTextContent("+2");
  });

  it("legenda visível com os três tipos em texto", () => {
    renderCal();
    const legenda = screen.getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Pessoal", "Médico", "Cuidado"]);
  });

  it("painel mostra o dia de hoje e troca ao selecionar outro dia", async () => {
    const user = userEvent.setup();
    renderCal();
    const painel = screen.getByRole("region", { name: "Sexta-feira, 9 de outubro de 2026" });
    expect(within(painel).getByText("titulo-falso-1")).toBeInTheDocument();
    expect(within(painel).getByText("titulo-falso-2")).toBeInTheDocument();

    await user.click(celula(/^1 de outubro/));
    const vazio = screen.getByRole("region", { name: "Quinta-feira, 1 de outubro de 2026" });
    expect(vazio).toHaveTextContent("Nenhum compromisso neste dia.");
    expect(celula(/^1 de outubro/).closest('[role="gridcell"]')).toHaveAttribute("aria-selected", "true");
  });

  it("teclado: setas, Home, End, PageUp e PageDown movem o foco; Enter e Espaço selecionam", async () => {
    const user = userEvent.setup();
    renderCal();
    celula(/^9 de outubro/).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(celula(/^10 de outubro/));
    expect(celula(/^10 de outubro/)).toHaveAttribute("tabindex", "0");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(celula(/^17 de outubro/));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(celula(/^11 de outubro/)); // domingo
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(celula(/^17 de outubro/)); // sábado
    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(celula(/^9 de outubro/));

    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Sexta-feira, 9 de outubro de 2026" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}{ }");
    expect(screen.getByRole("region", { name: "Quinta-feira, 8 de outubro de 2026" })).toBeInTheDocument();

    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid", { name: "Novembro de 2026" })).toBeInTheDocument();
    expect(document.activeElement).toBe(celula(/^8 de novembro/));
    await user.keyboard("{PageUp}{PageUp}");
    expect(screen.getByRole("grid", { name: "Setembro de 2026" })).toBeInTheDocument();
    expect(document.activeElement).toBe(celula(/^8 de setembro/));
  });

  it("seta para fora do mês troca o mês exibido", async () => {
    const user = userEvent.setup();
    renderCal();
    await user.click(celula(/^1 de outubro/));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("grid", { name: "Setembro de 2026" })).toBeInTheDocument();
    expect(document.activeElement).toBe(celula(/^30 de setembro/));
  });

  it("botões Mês anterior, Próximo mês e Hoje", async () => {
    const user = userEvent.setup();
    renderCal();
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("grid", { name: "Novembro de 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByRole("grid", { name: "Setembro de 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(screen.getByRole("grid", { name: "Outubro de 2026" })).toBeInTheDocument();
    expect(celula(/^9 de outubro/).closest('[role="gridcell"]')).toHaveAttribute("aria-selected", "true");
  });

  it("título de compromisso nunca vai para atributo title", () => {
    const { container } = renderCal();
    expect(container.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("sem violações de acessibilidade no axe", async () => {
    const { container } = renderCal();
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});

describe("Calendario: visão Dia", () => {
  async function irParaDia(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("radio", { name: "Dia" }));
  }

  it("linha do tempo do dia em ordem de horário e escolha guardada", async () => {
    const user = userEvent.setup();
    renderCal();
    await irParaDia(user);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sexta-feira, 9 de outubro de 2026" })).toBeInTheDocument();
    const itens = within(screen.getByRole("list", { name: "Compromissos por horário" })).getAllByRole("listitem");
    expect(itens.map((i) => i.querySelector("p.font-bold")?.textContent)).toEqual(["titulo-falso-1", "titulo-falso-2"]);
    expect(itens[0]).toHaveTextContent("10:00 às 11:00");
    expect(localStorage.getItem("agendaModo")).toBe("dia");
  });

  it("Dia anterior, Próximo dia, Hoje e estado vazio", async () => {
    const user = userEvent.setup();
    renderCal();
    await irParaDia(user);
    await user.click(screen.getByRole("button", { name: "Próximo dia" }));
    expect(screen.getByRole("heading", { name: "Sábado, 10 de outubro de 2026" })).toBeInTheDocument();
    expect(screen.getByText("Nenhum compromisso neste dia.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dia anterior" }));
    await user.click(screen.getByRole("button", { name: "Dia anterior" }));
    expect(screen.getByRole("heading", { name: "Quinta-feira, 8 de outubro de 2026" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(screen.getByRole("heading", { name: "Sexta-feira, 9 de outubro de 2026" })).toBeInTheDocument();
  });

  it("compromisso que cruza a meia-noite avisa que continua no dia seguinte", async () => {
    const user = userEvent.setup();
    renderCal();
    await user.click(celula(/^19 de outubro/));
    await irParaDia(user);
    expect(screen.getByRole("heading", { name: "Segunda-feira, 19 de outubro de 2026" })).toBeInTheDocument();
    expect(screen.getByText("Continua no dia seguinte.")).toBeInTheDocument();
  });

  it("abre no Dia quando essa foi a última escolha, mesmo sem storage", () => {
    localStorage.setItem("agendaModo", "dia");
    renderCal();
    expect(screen.getByRole("radio", { name: "Dia" })).toBeChecked();
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => renderCal()).not.toThrow();
  });
});
