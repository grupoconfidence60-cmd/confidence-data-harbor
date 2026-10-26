# Novas funcionalidades — Grupo Confidence

Entrega em 4 etapas, uma por vez, cada uma testada com conta conectada antes da próxima. O visual aprovado (azul, cinza, branco) é mantido.

## Etapa 1 — Estoque de equipamentos e uniformes (amplia a aba atual)
- Catálogo já com os 16 itens: calça, camisa, casaco, calçado, cobertura, gravata, cinto de nylon, cinto N.A., apito, fiel, crachá, colete, colete cruz, bornal, divisa, livro ATA (com tamanho).
- Movimentações: entrada no estoque, entrega, devolução, troca e baixa (perda/dano).
- Cada lançamento registra colaborador, posto, supervisor que autorizou, quem lançou, data e horário — sem edição posterior.
- Saldo em estoque por item, itens entregues e pendentes de devolução.
- Histórico filtrável por colaborador, posto, supervisor e período; Excel de conferência.
- Movimentam: Administração e RH (supervisor registra no seu posto).

## Etapa 2 — Contracheques
- RH envia vários PDFs de uma vez; cada arquivo é ligado ao colaborador pela matrícula ou CPF no nome do arquivo.
- Tela de conferência antes de liberar: mostra quem recebe cada arquivo e aponta os que não encontraram dono.
- Um botão "Distribuir" libera todos; cada colaborador recebe aviso no sino e vê só o seu, na área dele.
- Histórico por competência: enviado, disponível, visualizado (com data e hora).
- Arquivos guardados em área privada; apenas RH/Administração e o próprio colaborador acessam.

## Etapa 3 — Cursos e treinamentos
- Cadastro de cursos com vídeo (envio de arquivo) e público: função, posto ou colaboradores específicos, com prazo.
- Colaborador assiste na plataforma; não é possível avançar o vídeo além do já assistido nem marcar como concluído antes do final.
- Questionário opcional ao final com nota mínima.
- Conclusão registrada automaticamente; relatório de concluídos, em andamento e não iniciados; aviso de novos cursos.

## Etapa 4 — Avaliação de desempenho
- Modelos de avaliação por função, com critérios (pontualidade, assiduidade, postura, disciplina, responsabilidade, procedimentos, produtividade, equipe, qualidade) em nota de 1 a 5.
- Campos de pontos fortes, melhorias, plano de desenvolvimento e feedback.
- Supervisor avalia a equipe do seu posto; gestor, RH e Administração veem tudo.
- Histórico com evolução das notas e relatório filtrável com Excel.

## Permissões
- O colaborador continua vendo só: Meu ponto, Solicitações, Comunicados, e passa a ver Meus contracheques e Meus treinamentos.
- Todas as ações ficam na auditoria.
- "Permissões configuráveis" seguem os perfis atuais (Administração, RH, Gestor, Supervisor, Colaborador); um editor livre de permissões fica fora desta entrega.

## Detalhes técnicos
- Etapa 1: nova tabela de movimentações (insert-only, trigger calcula saldo e valida estoque), mantendo `material_entregas` para o histórico atual.
- Etapa 2: bucket privado `contracheques`, tabela com colaborador/competência/status, RLS por dono + has_any_role(admin, rh).
- Etapa 3: tabelas cursos, atribuições e progresso; progresso salvo pelo player, conclusão validada no banco (tempo assistido ≥ duração).
- Etapa 4: modelos e avaliações com RLS por posto via `supervisiona_posto`.
- Todas com audit_trigger, entrada no menu e em MODULE_ACCESS, e testes das regras de permissão.
