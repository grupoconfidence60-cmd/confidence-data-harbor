ALTER TABLE public.colaboradores
  ADD COLUMN disponibilidade_status text NOT NULL DEFAULT 'disponivel',
  ADD COLUMN disponibilidade_detalhe text;

ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_disponibilidade_status_valida
  CHECK (disponibilidade_status IN ('disponivel', 'ocupado', 'cobrindo'));

COMMENT ON COLUMN public.colaboradores.disponibilidade_status IS 'Situação operacional do intermitente: disponivel, ocupado ou cobrindo.';
COMMENT ON COLUMN public.colaboradores.disponibilidade_detalhe IS 'Local da ocupação ou nome de quem está sendo coberto; usado no posto Intermitentes.';