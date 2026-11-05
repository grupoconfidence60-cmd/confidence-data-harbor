ALTER TABLE public.materiais DROP CONSTRAINT IF EXISTS materiais_categoria_check;
ALTER TABLE public.materiais ADD CONSTRAINT materiais_categoria_check CHECK (categoria = ANY (ARRAY['equipamento','uniforme','escritorio','manutencao']));
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS grupo text NOT NULL DEFAULT '';
ALTER TABLE public.materiais ADD COLUMN IF NOT EXISTS estoque_minimo integer NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0);