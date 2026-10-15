import type { RequestHandler } from "express";

// Só para os testes de /auth/sync escritos antes do aceite gravado (D9, 2026-10-14): eles tratam de outras regras do
// cadastro, então recebem um aceite válido quando o corpo traz tipo_perfil e não traz aceite_documentos. As regras do
// próprio aceite (ausente, inválido, horário do servidor) ficam em routes/authAceiteDocumentos.test.ts, sem este atalho.
export const ACEITE_VALIDO_TESTE = { versao: "1.1", termos_privacidade: true, consentimento_saude: true };

export const comAceiteValido: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === "object" && "tipo_perfil" in req.body && !("aceite_documentos" in req.body)) {
    req.body.aceite_documentos = ACEITE_VALIDO_TESTE;
  }
  next();
};
