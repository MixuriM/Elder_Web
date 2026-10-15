import type { RequestHandler } from "express";

// Modo demonstração: conta do elenco (req.contaDemo, resolvido por requireAuth) não cria vínculo nem conta. Sem isto, o
// admin entraria como Paulo e pediria vínculo a um idoso real, ou cadastraria como Carlos um idoso com o e-mail de outra
// pessoa, e depois leria dado real. Fica logo depois da autenticação, antes de qualquer leitura do banco.
export const bloquearContaDemo: RequestHandler = (req, res, next) => {
  if (req.contaDemo) return res.status(403).json({ error: "Ação indisponível no modo demonstração." });
  next();
};
