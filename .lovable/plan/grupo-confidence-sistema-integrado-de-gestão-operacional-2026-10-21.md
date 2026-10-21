# Grupo Confidence — Sistema Integrado de Gestão Operacional

Plataforma real (banco de dados, login individual, permissões), construída em etapas. Cada etapa entrega telas que salvam dados de verdade — sem botões falsos nem números fictícios.

## Identidade visual
- Aguardando a logomarca oficial: as cores do sistema serão ajustadas a ela assim que for enviada.
- Até lá: tema corporativo sóbrio (azul-marinho profundo, grafite, detalhe dourado), tipografia moderna e legível, menu lateral por módulos, modo claro e escuro.

## Etapa 1 — Base (esta primeira entrega)
1. **Acesso seguro**: login por e-mail e senha; sem cadastro público — só a administração cria contas, convida e redefine senhas. Primeiro usuário cadastrado vira Administrador geral.
2. **Perfis de acesso**: Administrador geral, Gestor, Supervisor, RH/DP, Colaborador. Status da conta (ativo, inativo, bloqueado), último acesso.
3. **Usuários**: tela de gestão (criar, editar, bloquear, trocar perfil).
4. **Colaboradores**: cadastro completo (matrícula, CPF, contato, cargo, posto, supervisor, admissão, vínculo, situação), busca, filtros, histórico de alterações e transferências.
5. **Postos de serviço**: cadastro (cliente, endereço, tipo, efetivo previsto, supervisor responsável) e vínculo de colaboradores.
6. **Funções operacionais**: vigilante, bombeiro civil, apoio etc. (configurável).
7. **Painel principal**: indicadores reais (efetivo ativo, por posto, em férias, afastados, pendências).
8. **Auditoria**: registro automático de quem criou/alterou/excluiu o quê e quando.

## Etapa 2 — Operação diária
- Escalas de trabalho (12x36, 5x2, etc.) e cobertura por posto.
- Presença, faltas, atrasos, substituições.
- Férias, folgas e afastamentos com fluxo de solicitação e aprovação.
- Livro de ocorrências e relatórios de supervisão/visitas.

## Etapa 3 — Gestão complementar
- Documentos com anexos e alertas de vencimento (CNV, reciclagem, ASO).
- Treinamentos e qualificações; equipamentos, uniformes e materiais.
- Comunicados e notificações internas.
- Auditoria de qualidade e indicadores administrativos/financeiros.

## Etapa 4 — Acabamento
- Busca global, exportações (PDF/Excel) e impressão.
- Ajustes finos para smartphone, configurações gerais.
- Testes dos fluxos principais, documentação de uso, backup e publicação.

## Itens que dependem de serviço externo (informados quando chegarmos lá)
- Envio de convites/alertas por e-mail exige domínio de e-mail configurado.
- Ponto com geolocalização/foto e WhatsApp/SMS dependem de integrações adicionais.

## Detalhes técnicos
- Lovable Cloud: Postgres + Auth + Storage; RLS em todas as tabelas.
- Papéis em tabela própria `user_roles` + função `has_role` (security definer); permissões por módulo em `role_permissions` para perfis personalizados.
- Tabelas Etapa 1: profiles, user_roles, role_permissions, funcoes, postos, colaboradores, colaborador_historico, audit_log (triggers genéricos de auditoria).
- Supervisor vê só postos onde é responsável; colaborador só o próprio registro (via `colaboradores.user_id`).
- Criação de usuários pelo admin via server function com service role, após verificar `has_role(admin)`.
- Rotas protegidas sob `_authenticated`, layout com sidebar shadcn; TanStack Query para dados.
