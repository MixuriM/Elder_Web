import { Router } from "express";
import { prisma } from "../lib/prisma";
import { CANCELAMENTO_SOLICITACAO } from "../lib/modoDecisao";
import { CONFLITO_EMAIL } from "../lib/mensagensConflito";
import { baixarFotoDoGoogle, semFotoPerfil, USUARIO_SEM_FOTO_SELECT } from "../lib/fotoPerfil";
import {
  isTipoPerfil,
  isDuplicateEmail,
  isDuplicateFirebaseUid,
  isValidEmailFormat,
  verifyFirebaseToken,
} from "../lib/authHelpers";

const router = Router();

// RF-025 (Fluxo A) — vínculo automático Familiar↔Idoso quando o e-mail de cadastro do
// Familiar bate com email_convite_familiar de algum Idoso. Sem tabela de token: a
// confirmação de posse do e-mail reaproveita decoded.email_verified do Firebase.
// Aprovação imediata só quando o e-mail já chega verificado (comum em contas Google);
// senão fica pendente até o próximo login com email_verified=true (ver branch de login
// abaixo). Um Vinculo por Idoso encontrado — mais de um Idoso pode ter convidado o
// mesmo e-mail de Familiar.
async function vincularFamiliarConvidado(familiarId: number, email: string, emailVerified: boolean) {
  const idosos = await prisma.usuario.findMany({
    where: { tipo_perfil: "idoso", email_convite_familiar: email },
    select: { id: true },
  });
  if (idosos.length === 0) return;

  const agora = new Date();
  await Promise.all(
    idosos.map((idoso) =>
      prisma.vinculo.create({
        data: {
          idoso_id: idoso.id,
          vinculado_id: familiarId,
          tipo_vinculo: "familiar",
          origem: "convite_idoso",
          status: emailVerified ? "aprovado" : "pendente",
          data_solicitacao: agora,
          confirmado_em: emailVerified ? agora : undefined,
        },
      }),
    ),
  );
}

// Direção oposta do RF-025: Idoso se cadastra depois informando email_convite_familiar
// de um Familiar que já existe. Sempre pendente aqui — esta requisição não carrega o
// token do Familiar, então não há email_verified dele pra checar; promovido no próximo
// login do Familiar (branch de login abaixo).
async function vincularIdosoComFamiliarExistente(idosoId: number, emailFamiliar: string) {
  const familiar = await prisma.usuario.findFirst({
    where: { tipo_perfil: "familiar", email: emailFamiliar },
    select: { id: true },
  });
  if (!familiar) return;

  await prisma.vinculo.create({
    data: {
      idoso_id: idosoId,
      vinculado_id: familiar.id,
      tipo_vinculo: "familiar",
      origem: "convite_idoso",
      status: "pendente",
      data_solicitacao: new Date(),
    },
  });
}

router.post("/sync", async (req, res, next) => {
  // Express 4 não propaga rejeições de handlers async pro errorHandler sozinho —
  // sem esse try/catch externo, um erro assíncrono (ex.: Prisma fora do ar) vira
  // unhandled rejection e derruba o processo em vez de responder 500.
  try {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return res.status(401).json({ error: "Token ausente." });
    }

    const resultado = await verifyFirebaseToken(idToken);
    if (!resultado.ok) {
      return res.status(resultado.status).json({ error: resultado.error });
    }
    const decoded = resultado.decoded;

    // findFirst, não findUnique: firebase_uid não é @unique no Prisma (o índice único
    // é filtrado e manual, ver schema.prisma) — o client não conhece essa constraint.
    const usuarioExistente = await prisma.usuario.findFirst({
      where: { firebase_uid: decoded.uid },
      select: { id: true, tipo_perfil: true, modo_decisao_solicitado: true },
    });

    if (usuarioExistente) {
      // RF-033 (item 2.9): login do idoso sempre cancela uma transferência de
      // modo_decisao em curso, com prioridade sobre a expiração da janela de 7 dias —
      // mesmo se as duas coisas "acontecerem ao mesmo tempo". modo_decisao_motivo é
      // limpo junto (mesmo padrão da expiração sem segunda confirmação, ver
      // resolverEstadoModoDecisao em routes/vinculo.ts) — evita motivo órfão
      // sobrevivendo em GET /usuario/me sem nenhuma solicitação pra dar contexto.
      const agora = new Date();
      const dadosLogin: Record<string, unknown> = { ultimo_login_em: agora };
      if (usuarioExistente.tipo_perfil === "idoso" && usuarioExistente.modo_decisao_solicitado === "familiar") {
        Object.assign(dadosLogin, CANCELAMENTO_SOLICITACAO);
      }
      const usuarioAtualizado = await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: dadosLogin,
        select: USUARIO_SEM_FOTO_SELECT,
      });

      // RF-025 (Fluxo A): promove no login do Familiar os vínculos que ficaram
      // pendentes por falta de e-mail confirmado no momento do cadastro. Idempotente
      // por construção — updateMany só afeta linhas ainda 'pendente'.
      if (usuarioExistente.tipo_perfil === "familiar" && decoded.email_verified) {
        await prisma.vinculo.updateMany({
          where: {
            vinculado_id: usuarioExistente.id,
            tipo_vinculo: "familiar",
            // RF-025 (convite_idoso) e RF-030 (cadastro_familiar): ambos aprovam por
            // confirmação de posse do e-mail do Familiar. solicitacao_familiar é manual.
            origem: { in: ["convite_idoso", "cadastro_familiar"] },
            status: "pendente",
          },
          data: { status: "aprovado", confirmado_em: new Date() },
        });
      }
      return res.status(200).json({ criado: false, usuario: semFotoPerfil(usuarioAtualizado) });
    }

    // Não achou pelo firebase_uid: é cadastro. tipo_perfil é obrigatório aqui — nunca
    // no fluxo de login simples, e nunca inferido, porque é fixo/único por conta.
    const tipoPerfil = req.body?.tipo_perfil;
    if (!isTipoPerfil(tipoPerfil)) {
      return res
        .status(400)
        .json({ error: "tipo_perfil obrigatório ao criar conta (idoso, cuidador ou familiar)." });
    }

    const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : decoded.name;

    if (!decoded.email && !decoded.phone_number) {
      return res.status(400).json({ error: "Conta Firebase sem e-mail ou telefone associado." });
    }

    // email_convite_familiar (RF-024): só o idoso informa, pra casar depois com o
    // cadastro de um Familiar (RF-025, fora de escopo aqui). Não é único — mais de um
    // idoso pode indicar o mesmo e-mail de familiar.
    const emailConviteFamiliarRaw = req.body?.email_convite_familiar;
    let emailConviteFamiliar: string | undefined;
    if (
      emailConviteFamiliarRaw !== undefined &&
      emailConviteFamiliarRaw !== null &&
      emailConviteFamiliarRaw !== ""
    ) {
      if (tipoPerfil !== "idoso") {
        return res
          .status(400)
          .json({ error: "email_convite_familiar só pode ser informado por idoso." });
      }
      if (typeof emailConviteFamiliarRaw !== "string" || !isValidEmailFormat(emailConviteFamiliarRaw.trim())) {
        return res.status(400).json({ error: "email_convite_familiar em formato inválido." });
      }
      if (emailConviteFamiliarRaw.trim().length > 255) {
        return res.status(400).json({ error: "email_convite_familiar deve ter até 255 caracteres." });
      }
      emailConviteFamiliar = emailConviteFamiliarRaw.trim();
    }

    // RNF-011 (3.2) / RF-030 extensão (3.3): valida o e-mail ANTES do INSERT. Quando a
    // linha encontrada é um idoso cadastrado por Familiar (sem firebase_uid) com o mesmo
    // e-mail do token: se já verificado, é o próprio idoso assumindo a conta — anexa o
    // firebase_uid a essa linha em vez de criar outra (nunca create nesse caminho); se
    // ainda não verificado, devolve orientação específica pra confirmar o e-mail. Em
    // qualquer outro caso o corpo é o genérico EMAIL_JA_EM_USO, pra não revelar a
    // natureza da conta que ocupa o e-mail. O catch abaixo continua como rede de
    // segurança pra corrida.
    if (decoded.email) {
      const existente = await prisma.usuario.findFirst({
        where: { email: decoded.email },
        select: { id: true, firebase_uid: true, cadastrado_por_id: true },
      });
      if (existente) {
        const idosoCadastradoPorFamiliar =
          tipoPerfil === "idoso" && existente.firebase_uid === null && existente.cadastrado_por_id !== null;

        if (idosoCadastradoPorFamiliar && decoded.email_verified === true) {
          const usuarioAnexado = await prisma.usuario.update({
            where: { id: existente.id },
            data: { firebase_uid: decoded.uid },
            select: USUARIO_SEM_FOTO_SELECT,
          });
          return res.status(200).json({ criado: false, usuario: semFotoPerfil(usuarioAnexado) });
        }

        return res
          .status(409)
          .json(idosoCadastradoPorFamiliar ? CONFLITO_EMAIL.EMAIL_CADASTRADO_POR_FAMILIAR : CONFLITO_EMAIL.EMAIL_JA_EM_USO);
      }
    }

    // nome só é exigido daqui pra baixo: o caminho de anexo acima nunca chega aqui
    // (sempre retorna antes) e nunca usa nome — ConfirmarEmail.tsx (item 3.3) não tem
    // como enviar um nome pra esse caso (idoso logado por e-mail/senha não tem
    // displayName no Firebase), e não precisa: a linha existente já tem o nome que o
    // Familiar informou no cadastro.
    if (!nome) {
      return res.status(400).json({ error: "nome obrigatório ao criar conta." });
    }
    // Coluna Usuario.nome é NVarChar(150): acima disso o INSERT estoura e viraria 500.
    if (nome.length > 150) {
      return res.status(400).json({ error: "nome deve ter até 150 caracteres." });
    }

    // Seed único da foto do Google, só neste branch de criação (nunca login nem anexo 3.3).
    const fotoGoogle = decoded.picture ? await baixarFotoDoGoogle(decoded.picture) : null;

    try {
      const usuario = await prisma.usuario.create({
        data: {
          firebase_uid: decoded.uid,
          nome,
          email: decoded.email,
          telefone: decoded.phone_number,
          tipo_perfil: tipoPerfil,
          email_convite_familiar: emailConviteFamiliar,
          // ER: modo_decisao obrigatório para idoso; autocadastro nasce decidindo por si.
          ...(tipoPerfil === "idoso" && { modo_decisao: "idoso" }),
          ...(fotoGoogle && {
            foto_perfil: fotoGoogle.foto,
            foto_perfil_mime_type: fotoGoogle.mimeType,
            foto_perfil_atualizada_em: new Date(),
          }),
        },
        select: USUARIO_SEM_FOTO_SELECT,
      });

      // RF-025 (Fluxo A) — as duas direções: Familiar chegando depois do Idoso, ou
      // Idoso chegando depois do Familiar. Nunca as duas no mesmo cadastro, tipo_perfil
      // é fixo e único por conta.
      if (tipoPerfil === "familiar" && decoded.email) {
        await vincularFamiliarConvidado(usuario.id, decoded.email, decoded.email_verified ?? false);
      } else if (tipoPerfil === "idoso" && emailConviteFamiliar) {
        await vincularIdosoComFamiliarExistente(usuario.id, emailConviteFamiliar);
      }

      return res.status(201).json({ criado: true, usuario: semFotoPerfil(usuario) });
    } catch (e) {
      if (isDuplicateFirebaseUid(e)) {
        // Duas requisições de sync simultâneas pro mesmo firebase_uid novo (ex.: dois
        // cliques rápidos) — a constraint do banco rejeitou a segunda criação, devolve
        // o registro que a primeira já criou em vez de estourar 500.
        const usuario = await prisma.usuario.findFirst({
          where: { firebase_uid: decoded.uid },
          select: USUARIO_SEM_FOTO_SELECT,
        });
        if (usuario) {
          return res.status(200).json({ criado: false, usuario: semFotoPerfil(usuario) });
        }
      }
      if (isDuplicateEmail(e)) {
        return res.status(409).json(CONFLITO_EMAIL.EMAIL_JA_EM_USO);
      }
      return next(e);
    }
  } catch (e) {
    next(e);
  }
});

export default router;
