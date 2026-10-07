import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import CardAjuda from "./CardAjuda";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("CardAjuda", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("navega para /orientacoes ao clicar em 'Ver orientações'", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CardAjuda />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /ver orientações/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/orientacoes");
  });
});
