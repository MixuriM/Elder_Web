# Elder Web — Estrutura ER (nível lógico)

> Estado atual do modelo (consolidado após 9 revisões). As tabelas abaixo mostram
> **o schema como ele é hoje** — sem tags de revisão espalhadas pelo meio. Todo o
> raciocínio, o histórico de mudanças e as decisões de risco aceito ficam nas
> seções 4, 5 e 6, no fim do documento. Se você só precisa consultar a estrutura,
> pare nas seções 1–2. Se precisa defender uma decisão na banca, vá direto pra
> seção 4 ou 5.

---

## 1. Tabelas de entidade

### Usuario

| Atributo                            | Tipo           | PK/FK            | Obrigatório                                   | Descrição                                                                                                                                                                                                                                                             |
|-------------------------------------|----------------|------------------|-----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                                  | int (identity) | PK               | Sim                                           | Identificador interno. Tudo no banco referencia este id, não o firebase_uid.                                                                                                                                                                                          |
| firebase_uid                        | nvarchar(128)  | —                | Sim, exceto idoso cadastrado por familiar (3) | UID retornado pelo Firebase Auth. Único (índice filtrado — permite múltiplos NULL), não é PK.                                                                                                                                                                        |
| nome                                | nvarchar(150)  | —                | Sim                                           | Nome do usuário.                                                                                                                                                                                                                                                      |
| email                               | nvarchar(255)  | —                | Sim, exceto idoso cadastrado por familiar (1) | E-mail de cadastro. Usado pro login e pro matching do Fluxo A de vínculo familiar.                                                                                                                                                                                    |
| telefone                            | nvarchar(20)   | —                | Não (1)                                       | Identificador alternativo de login/recuperação. Existe porque RF-004 já previa recuperação por telefone.                                                                                                                                                              |
| tipo_perfil                         | nvarchar(20)   | —                | Sim                                           | 'idoso' / 'cuidador' / 'familiar'. Fixo e único por conta — sem hibridismo (decisão fechada, seção 5).                                                                                                                                                                |
| email_convite_familiar              | nvarchar(255)  | —                | Não                                           | Só usado quando tipo_perfil='idoso'. E-mail que dispara o Fluxo A de vínculo automático.                                                                                                                                                                              |
| cadastrado_por_id                   | int            | FK -> Usuario.id | Não                                           | Quem criou esta conta, quando não foi autocadastro. NULL = autocadastro (RF-001). Preenchido = Familiar cadastrou via RF-030. Alimenta o valor inicial sugerido de modo_decisao, abaixo.                                                                              |
| termo_responsabilidade_aceito_em    | datetime2      | —                | Não                                           | Timestamp de aceite da declaração de responsabilidade do Familiar no cadastro via RF-030. Só preenchido quando cadastrado_por_id IS NOT NULL. Não verifica veracidade — é aceite formal (ver seção 5).                                                                |
| modo_decisao                        | nvarchar(10)   | —                | Sim, quando tipo_perfil='idoso'               | 'idoso' / 'familiar'. Quem tem autoridade hoje pra definir Vinculo.permite_* deste idoso (ver "Sistema de permissões do Cuidador", seção 3). Valor inicial sugerido por cadastrado_por_id, mas independente e sempre alterável depois — inclusive pelo próprio idoso. |
| ultimo_login_em                     | datetime2      | —                | Não                                           | Timestamp do último login. Usado pra detectar atividade do idoso durante a janela de carência de uma transferência de modo_decisao.                                                                                                                                   |
| modo_decisao_solicitado             | nvarchar(10)   | —                | Não                                           | Valor pendente ('familiar') enquanto uma transferência está na janela de carência (2). NULL quando não há solicitação em curso.                                                                                                                                       |
| modo_decisao_solicitado_por_id      | int            | FK -> Usuario.id | Não                                           | Familiar que solicitou a transferência.                                                                                                                                                                                                                               |
| modo_decisao_solicitado_em          | datetime2      | —                | Não                                           | Início da janela de carência (2).                                                                                                                                                                                                                                     |
| modo_decisao_expira_em              | datetime2      | —                | Não                                           | Fim da janela de carência (2).                                                                                                                                                                                                                                        |
| modo_decisao_segunda_confirmacao_id | int            | FK -> Usuario.id | Não                                           | Segundo Familiar (diferente do solicitante) que confirmou a transferência. Só exigido quando existe mais de um Vinculo tipo 'familiar' aprovado pro idoso (2).                                                                                                        |
| modo_decisao_alterado_por_id        | int            | FK -> Usuario.id | Não                                           | Quem fez a última mudança efetiva em modo_decisao.                                                                                                                                                                                                                    |
| modo_decisao_alterado_em            | datetime2      | —                | Não                                           | Quando modo_decisao foi alterado pela última vez.                                                                                                                                                                                                                     |
| modo_decisao_motivo                 | nvarchar(300)  | —                | Não                                           | Justificativa opcional do Familiar ao alterar modo_decisao. Não validado, é só transparência.                                                                                                                                                                         |
| created_at                          | datetime2      | —                | Sim                                           | —                                                                                                                                                                                                                                                                     |
| updated_at                          | datetime2      | —                | Sim                                           | —                                                                                                                                                                                                                                                                     |

Constraint de tabela: CHECK (email IS NOT NULL OR telefone IS NOT NULL) — garante
que toda conta tem pelo menos um identificador de contato/login.

(1) email aceita NULL quando tipo_perfil='idoso' E cadastrado_por_id IS NOT NULL
(idoso sem e-mail próprio, cadastrado pelo familiar). Nesse caso o índice único de
email precisa ser filtrado (WHERE email IS NOT NULL), porque UNIQUE padrão do
SQL Server só aceita um NULL. telefone supre a ausência de e-mail nesse cenário.

(2) Mecanismo completo (janela de carência + segunda confirmação) explicado na
seção 3, "Sistema de permissões do Cuidador".

(3) firebase_uid aceita NULL quando cadastrado_por_id IS NOT NULL (idoso
cadastrado pelo familiar via RF-030, sem login Firebase próprio ainda) — mesmo
padrão de índice único filtrado usado para email, acima. CHECK
(firebase_uid IS NOT NULL OR cadastrado_por_id IS NOT NULL) garante que
autocadastro (sempre via /auth/sync com token Firebase) nunca fica sem
firebase_uid. Decisão registrada em CLAUDE.md, "firebase_uid nullable" —
migration 20260902014014_firebase_uid_nullable (2026-09-01).

### Vinculo (generalizado — cuidador e familiar)

| Atributo                     | Tipo           | PK/FK            | Obrigatório | Descrição                                                                                                                                                                                  |
|------------------------------|----------------|------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                           | int (identity) | PK               | Sim         | —                                                                                                                                                                                          |
| idoso_id                     | int            | FK -> Usuario.id | Sim         | O idoso do vínculo, em ambos os tipos.                                                                                                                                                     |
| vinculado_id                 | int            | FK -> Usuario.id | Sim         | O cuidador ou familiar do vínculo.                                                                                                                                                         |
| tipo_vinculo                 | nvarchar(20)   | —                | Sim         | 'cuidador' / 'familiar'.                                                                                                                                                                   |
| origem                       | nvarchar(30)   | —                | Sim         | 'solicitacao_cuidador' / 'convite_idoso' (Fluxo A) / 'solicitacao_familiar' (Fluxo B) / 'cadastro_familiar' (nasce do RF-030). Determina a regra de aprovação.                             |
| status                       | nvarchar(20)   | —                | Sim         | 'pendente' / 'aprovado' / 'recusado'.                                                                                                                                                      |
| aprovador_id                 | int            | FK -> Usuario.id | Não         | Quem aprovou/recusou manualmente. NULL quando origem = 'convite_idoso' ou 'cadastro_familiar' — nesses dois casos a aprovação é por confirmação de e-mail, não humana (ver confirmado_em). |
| data_solicitacao             | datetime2      | —                | Sim         | —                                                                                                                                                                                          |
| data_resposta                | datetime2      | —                | Não         | Preenchido quando status sai de 'pendente'.                                                                                                                                                |
| confirmado_em                | datetime2      | —                | Não         | Timestamp da confirmação de posse do e-mail envolvido (Fluxo A / cadastro pelo familiar) — é essa confirmação, não aprovação humana, que move o status pra 'aprovado' nesses fluxos.       |
| notificado_em                | datetime2      | —                | Não         | Timestamp de quando o Familiar foi notificado sobre um vínculo automático criado em seu nome (origem='convite_idoso'). Permite contestar via RF-022 mesmo já 'aprovado'.                   |
| permite_registrar_saude      | bit            | —                | Não         | Só relevante quando tipo_vinculo='cuidador'. Default false.                                                                                                                                |
| permite_marcar_dose          | bit            | —                | Não         | Idem, pra marcar dose administrada. Default false.                                                                                                                                         |
| permite_criar_evento_cuidado | bit            | —                | Não         | Idem, pra criar Evento tipo 'cuidado'. Default false.                                                                                                                                      |
| definido_por_id              | int            | FK -> Usuario.id | Não         | Quem definiu/alterou as 3 permissões acima por último. Quem pode escrever é determinado por Usuario.modo_decisao do idoso — este campo é só auditoria.                                     |
| definido_em                  | datetime2      | —                | Não         | Quando as permissões foram definidas/alteradas pela última vez.                                                                                                                            |

### Evento

| Atributo         | Tipo           | PK/FK            | Obrigatório | Descrição                                                                                                         |
|------------------|----------------|------------------|-------------|-------------------------------------------------------------------------------------------------------------------|
| id               | int (identity) | PK               | Sim         | —                                                                                                                 |
| idoso_id         | int            | FK -> Usuario.id | Sim         | Dono da agenda.                                                                                                   |
| criado_por_id    | int            | FK -> Usuario.id | Sim         | Quem criou (idoso, familiar, ou cuidador — só tipo 'cuidado', e só se Vinculo.permite_criar_evento_cuidado=true). |
| tipo_evento      | nvarchar(30)   | —                | Sim         | CHECK (tipo_evento IN ('cuidado', 'medico', 'pessoal')).                                                          |
| titulo           | nvarchar(150)  | —                | Sim         | —                                                                                                                 |
| descricao        | nvarchar(500)  | —                | Não         | —                                                                                                                 |
| data_hora_inicio | datetime2      | —                | Sim         | —                                                                                                                 |
| data_hora_fim    | datetime2      | —                | Não         | —                                                                                                                 |
| editado_por_id   | int            | FK -> Usuario.id | Não         | Opcional/sugerido — quem fez a última edição.                                                                     |
| created_at       | datetime2      | —                | Sim         | —                                                                                                                 |
| updated_at       | datetime2      | —                | Sim         | —                                                                                                                 |

### Medicamento (prescrição)

| Atributo       | Tipo           | PK/FK            | Obrigatório | Descrição                           |
|----------------|----------------|------------------|-------------|-------------------------------------|
| id             | int (identity) | PK               | Sim         | —                                   |
| idoso_id       | int            | FK -> Usuario.id | Sim         | —                                   |
| criado_por_id  | int            | FK -> Usuario.id | Sim         | Idoso ou familiar — nunca cuidador. |
| nome           | nvarchar(150)  | —                | Sim         | —                                   |
| dosagem        | nvarchar(50)   | —                | Sim         | —                                   |
| frequencia     | nvarchar(100)  | —                | Sim         | —                                   |
| data_inicio    | date           | —                | Sim         | —                                   |
| data_fim       | date           | —                | Não         | —                                   |
| observacoes    | nvarchar(500)  | —                | Não         | —                                   |
| ativo          | bit            | —                | Sim         | —                                   |
| editado_por_id | int            | FK -> Usuario.id | Não         | Opcional/sugerido.                  |
| created_at     | datetime2      | —                | Sim         | —                                   |
| updated_at     | datetime2      | —                | Sim         | —                                   |

Familiar visualiza esta entidade com o mesmo nível de acesso do Idoso — cobertura já
dada pela RNF-003 (checagem de vínculo aprovado), sem campo novo aqui.

### RegistroDoseMedicamento

Existe incondicionalmente no schema (não depende de nenhuma "variante" global). O que
varia por vínculo é se um Cuidador específico tem Vinculo.permite_marcar_dose = true
pra poder gravar aqui — Idoso e Familiar sempre podem usar, sem essa checagem.

| Atributo                | Tipo           | PK/FK                | Obrigatório | Descrição                                                  |
|-------------------------|----------------|----------------------|-------------|------------------------------------------------------------|
| id                      | int (identity) | PK                   | Sim         | —                                                          |
| medicamento_id          | int            | FK -> Medicamento.id | Sim         | Prescrição à qual essa dose se refere.                     |
| registrado_por_id       | int            | FK -> Usuario.id     | Sim         | Idoso, familiar, ou cuidador com permite_marcar_dose=true. |
| data_hora_administracao | datetime2      | —                    | Sim         | —                                                          |
| status_administracao    | nvarchar(20)   | —                    | Sim         | 'administrado' / 'pulado' / 'atrasado'.                    |
| observacoes             | nvarchar(300)  | —                    | Não         | —                                                          |
| created_at              | datetime2      | —                    | Sim         | —                                                          |

### RegistroSaude

| Atributo          | Tipo           | PK/FK            | Obrigatório | Descrição                                                                                                                                                          |
|-------------------|----------------|------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| id                | int (identity) | PK               | Sim         | —                                                                                                                                                                  |
| idoso_id          | int            | FK -> Usuario.id | Sim         | —                                                                                                                                                                  |
| registrado_por_id | int            | FK -> Usuario.id | Sim         | Idoso, familiar, ou cuidador com permite_registrar_saude=true.                                                                                                     |
| tipo_medicao      | nvarchar(50)   | —                | Sim         | Ex.: 'pressao', 'glicemia', 'peso'.                                                                                                                                |
| valor_1           | decimal(6,2)   | —                | Sim         | Primeiro (ou único) número da medição — ex.: sistólica, ou valor único de glicemia/peso.                                                                           |
| valor_2           | decimal(6,2)   | —                | Não         | Segundo número, só quando a medição tiver dois (ex.: diastólica).                                                                                                  |
| unidade           | nvarchar(20)   | —                | Sim         | Ex.: 'mmHg', 'mg/dL', 'kg'.                                                                                                                                        |
| data_hora         | datetime2      | —                | Sim         | —                                                                                                                                                                  |
| observacoes       | nvarchar(300)  | —                | Não         | —                                                                                                                                                                  |
| editado_por_id    | int            | FK -> Usuario.id | Sim         | Obrigatório aqui (diferente das outras 3 entidades) — exigido pela RNF-006 do TCC original. Preenchido com registrado_por_id na criação; atualizado a cada edição. |
| created_at        | datetime2      | —                | Sim         | —                                                                                                                                                                  |
| updated_at        | datetime2      | —                | Sim         | —                                                                                                                                                                  |

### RegistroAlimentar

| Atributo          | Tipo           | PK/FK            | Obrigatório | Descrição                                        |
|-------------------|----------------|------------------|-------------|--------------------------------------------------|
| id                | int (identity) | PK               | Sim         | —                                                |
| idoso_id          | int            | FK -> Usuario.id | Sim         | —                                                |
| registrado_por_id | int            | FK -> Usuario.id | Sim         | Idoso ou familiar — cuidador nunca (regra fixa). |
| refeicao          | nvarchar(50)   | —                | Sim         | Ex.: 'cafe_manha', 'almoco'.                     |
| descricao         | nvarchar(500)  | —                | Sim         | —                                                |
| data_hora         | datetime2      | —                | Sim         | —                                                |
| editado_por_id    | int            | FK -> Usuario.id | Não         | Opcional/sugerido.                               |
| created_at        | datetime2      | —                | Sim         | —                                                |
| updated_at        | datetime2      | —                | Sim         | —                                                |

---

## 2. Tabela de relacionamentos

| Entidade origem | Entidade destino        | Cardinalidade | FK                                          | Regra de negócio                                                                             |
|-----------------|-------------------------|---------------|---------------------------------------------|----------------------------------------------------------------------------------------------|
| Usuario         | Usuario                 | 1:N           | Usuario.cadastrado_por_id                   | Um Familiar pode ter cadastrado várias contas de Idoso.                                      |
| Usuario         | Usuario                 | 1:N           | Usuario.modo_decisao_solicitado_por_id      | Familiar que solicitou transferência de modo_decisao.                                        |
| Usuario         | Usuario                 | 1:N           | Usuario.modo_decisao_segunda_confirmacao_id | Segundo Familiar que confirmou a transferência, quando exigido.                              |
| Usuario         | Usuario                 | 1:N           | Usuario.modo_decisao_alterado_por_id        | Quem fez a última mudança efetiva.                                                           |
| Usuario         | Vinculo                 | 1:N           | Vinculo.idoso_id                            | Um idoso pode ter vários vínculos (N cuidadores, N familiares).                              |
| Usuario         | Vinculo                 | 1:N           | Vinculo.vinculado_id                        | Um cuidador/familiar pode ter vínculo com mais de um idoso (N:N — decisão fechada, seção 5). |
| Usuario         | Vinculo                 | 1:N           | Vinculo.aprovador_id                        | Aprovação manual; nulo se aprovação por confirmação de e-mail.                               |
| Usuario         | Vinculo                 | 1:N           | Vinculo.definido_por_id                     | Quem definiu as permissões operacionais de um vínculo de Cuidador.                           |
| Usuario         | Evento                  | 1:N           | Evento.idoso_id                             | Agenda pertence ao idoso.                                                                    |
| Usuario         | Evento                  | 1:N           | Evento.criado_por_id                        | Quem criou o compromisso.                                                                    |
| Usuario         | Evento                  | 1:N           | Evento.editado_por_id                       | Última edição (opcional).                                                                    |
| Usuario         | Medicamento             | 1:N           | Medicamento.idoso_id                        | Prescrição pertence ao idoso.                                                                |
| Usuario         | Medicamento             | 1:N           | Medicamento.criado_por_id                   | Cadastrado por idoso ou familiar apenas.                                                     |
| Usuario         | Medicamento             | 1:N           | Medicamento.editado_por_id                  | Opcional.                                                                                    |
| Medicamento     | RegistroDoseMedicamento | 1:N           | RegistroDoseMedicamento.medicamento_id      | Uma prescrição gera N execuções de dose.                                                     |
| Usuario         | RegistroDoseMedicamento | 1:N           | RegistroDoseMedicamento.registrado_por_id   | Quem marcou a dose administrada.                                                             |
| Usuario         | RegistroSaude           | 1:N           | RegistroSaude.idoso_id                      | —                                                                                            |
| Usuario         | RegistroSaude           | 1:N           | RegistroSaude.registrado_por_id             | Idoso, familiar ou cuidador autorizado.                                                      |
| Usuario         | RegistroSaude           | 1:N           | RegistroSaude.editado_por_id                | Obrigatório (RNF-006).                                                                       |
| Usuario         | RegistroAlimentar       | 1:N           | RegistroAlimentar.idoso_id                  | —                                                                                            |
| Usuario         | RegistroAlimentar       | 1:N           | RegistroAlimentar.registrado_por_id         | Idoso ou familiar apenas.                                                                    |
| Usuario         | RegistroAlimentar       | 1:N           | RegistroAlimentar.editado_por_id            | Opcional.                                                                                    |

---

## 3. Mecanismos-chave (como as coisas funcionam por baixo)

### Sistema de permissões do Cuidador

Não é mais uma escolha global do sistema ("Variante 1 vs Variante 2") — é uma
configuração por vínculo, controlada por 3 flags em Vinculo
(permite_registrar_saude, permite_marcar_dose, permite_criar_evento_cuidado),
todas nascendo false. Alimentação nunca é configurável — Cuidador só visualiza,
sempre.

Quem tem autoridade para ligar essas flags é Usuario.modo_decisao do idoso
('idoso' ou 'familiar') — não é o Idoso e o Familiar disputando a mesma escrita,
é sempre um dos dois com a caneta, dependendo do valor do campo.

Transferência de modo_decisao para 'familiar' (RF-033) não é instantânea:

1. Familiar solicita -> modo_decisao_solicitado='familiar', janela de carência de
   7 dias inicia (modo_decisao_solicitado_em -> modo_decisao_expira_em).
2. Se o idoso logar (ultimo_login_em) dentro da janela -> solicitação cancelada
   automaticamente, campos voltam a NULL.
3. Se o idoso tiver mais de um Familiar com vínculo aprovado -> exige confirmação de
   um segundo Familiar diferente do solicitante antes de efetivar.
4. Se a janela expirar sem login do idoso (e com a segunda confirmação, quando
   exigida) -> modo_decisao é atualizado, idoso é notificado.

### Vínculo automático Familiar<->Idoso (Fluxo A e cadastro pelo Familiar)

Dois fluxos usam aprovação por confirmação de e-mail, não aprovação manual:

- Fluxo A (origem='convite_idoso'): idoso informa e-mail de um familiar no
  próprio cadastro; quando esse e-mail se cadastra como Familiar, o vínculo nasce e
  só vira 'aprovado' após confirmar posse do e-mail (confirmado_em).
- Cadastro pelo Familiar (origem='cadastro_familiar', RF-030): mesma lógica de
  confirmação de e-mail, usada quando é o Familiar quem cria a conta do Idoso.

Em ambos, Vinculo.notificado_em registra quando o outro lado foi avisado, para
permitir contestação (RF-022) mesmo depois de já 'aprovado'.

---

## 4. Histórico de revisões (resumo)

| Revisão | O que mudou                                                                                                                                                                                               |
|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| REV.1   | Modelo original — vínculo genérico Cuidador/Familiar, origem, email_convite_familiar.                                                                                                                     |
| REV.2   | cadastrado_por_id, origem='cadastro_familiar', confirmado_em — suporte ao RF-030 (cadastro de idoso pelo familiar) e à formalização de acesso do Familiar em Saúde/Remédios.                              |
| REV.3   | Limitações do Cuidador viram configuração por vínculo (Vinculo.permite_*); RegistroDoseMedicamento deixa de ser condicional a variante global.                                                            |
| REV.4   | (superada pela REV.5) Tentativa de resolver arbitragem via cadastrado_por_id direto — tinha fragilidade real, corrigida a seguir.                                                                         |
| REV.5   | Usuario.modo_decisao substitui cadastrado_por_id como fonte de autoridade — campo explícito, mutável, auditado.                                                                                           |
| REV.6   | Termo de responsabilidade; e-mail opcional + telefone; RegistroSaude estruturado (valor_1/valor_2/unidade); tipo_evento com enum fechado; notificação de vínculo automático; tipo_perfil fixo confirmado. |
| REV.7   | Janela de carência + segunda confirmação para transferência de modo_decisao.                                                                                                                              |
| REV.8   | Fecha os 4 pontos em aberto até então — 2 como risco residual aceito, 2 como decisão técnica direta (ver seção 5).                                                                                        |
| REV.9   | RegistroSaude.editado_por_id obrigatório (RNF-006); CHECK (email IS NOT NULL OR telefone IS NOT NULL).                                                                                                    |
| REV.10  | firebase_uid passa a nullable (mesmo padrão de índice filtrado do email) para suportar RF-030 — idoso cadastrado por familiar não tem login Firebase próprio de imediato. Ver nota (3) em Usuario.        |

---

## 5. Decisões fechadas (o "porquê" por trás do schema atual)

Separado em dois tipos — a diferença importa se a banca perguntar:

### 5.1 Decisões técnicas diretas (sem ambiguidade remanescente)

- tipo_perfil fixo e único. Sem hibridismo de papéis. Não há justificativa de
  negócio nos documentos-fonte pra permitir acúmulo, e custaria caro no schema
  (N:N com contexto) sem ganho identificado.
- Cardinalidade N:N idoso<->cuidador/familiar. Mantida. Justificativa: o próprio
  texto do TCC (RF-020 + módulo HomeCare) descreve o Cuidador como profissional
  autônomo "que deseja encontrar uma vaga" — modelo de mercado, não vínculo fixo
  1:1. Um Cuidador plausivelmente atende mais de um Idoso; um Idoso pode trocar de
  Cuidador ou ter mais de um em turnos diferentes. (Nota: a justificativa inicial
  citava a proporção de equipe do Lar São Vicente de Paulo — estava errada, aquela
  entrevista foi só levantamento de necessidades, não é o contexto de uso do
  produto. Corrigido.)
- Duração da janela de carência = 7 dias. Sem base documental pro número exato
  — é decisão de projeto, implementada como parâmetro configurável (não hardcoded),
  registrada como escolha, não suposição.
- RegistroSaude.editado_por_id obrigatório. Exigido pela RNF-006 do TCC
  original, que nunca tinha sido de fato aplicada ao schema — corrigido, não é
  decisão nova, é alinhamento a requisito já existente.

### 5.2 Riscos residuais aceitos (decisão de escopo, não solução técnica)

Estes dois pontos não têm solução de engenharia possível dentro do escopo de um
TCC — a decisão do grupo foi parar de mitigar além de um certo ponto e documentar
isso, em vez de inventar um mecanismo que parecesse resolver sem resolver de fato.

Consentimento do idoso no RF-030. Nada no sistema verifica que o idoso concorda
em ter a conta criada por um terceiro. Mitigação final adotada: declaração de
responsabilidade do Familiar (termo_responsabilidade_aceito_em) — é aceite formal
registrado, não verificação. Verificação real exigiria instrumento jurídico externo
(procuração/curatela), fora do escopo técnico por decisão consciente. O grupo optou
por não introduzir um mecanismo de revisão por terceiro porque isso reintroduziria a
necessidade de uma entidade institucional de revisão, já descartada (Instituição
fora do escopo, decisão travada).

Perda progressiva de capacidade do idoso após autocadastro. Não existe gatilho
técnico que detecte declínio cognitivo. Mitigação final: janela de carência de 7
dias (cancelável por login do idoso) + segunda confirmação quando há mais de um
familiar vinculado (seção 3). Quando o idoso realmente não consegue mais logar, ou
quando só existe um familiar vinculado, essas mitigações não impedem a
transferência — e o grupo decide parar nesse ponto. Solução mais forte exigiria
curatela/interdição judicial, fora do escopo técnico. Deliberadamente não foi
adicionado nenhum mecanismo de "avaliação de capacidade" dentro do app — isso daria
falsa impressão de rigor que não se sustenta numa arguição.

Recomendação para o TCC: estes dois pontos devem constar explicitamente na
seção de "Limitações" ou "Trabalhos Futuros", com a redação acima. É diferente de
"não resolvemos" — é "decidimos onde parar, e por quê", que é uma resposta muito
mais defensável numa banca.

---

## 6. Coisas explicitamente fora de escopo (não reabrir)

- Entidade Instituição — não existe no modelo, decisão travada.
- Qualquer funcionalidade de áudio/microfone — fora do escopo, decisão travada.
- Aprovação do vínculo Cuidador<->Idoso — continua manual, não afetada pelas
  orientações sobre cadastro de conta.
- Verificação jurídica de capacidade civil (curatela/interdição) — fora do escopo
  técnico por decisão consciente (seção 5.2), não por omissão.
