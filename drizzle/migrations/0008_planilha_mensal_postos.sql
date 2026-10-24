CREATE OR REPLACE FUNCTION public.can_manage_planilha(_posto_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$ SELECT public.has_any_role(auth.uid(),ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND EXISTS(SELECT 1 FROM public.postos WHERE id=_posto_id AND supervisor_id=auth.uid())) $$;
CREATE TABLE public.posto_planilha (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 posto_id uuid NOT NULL REFERENCES public.postos(id),
 colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
 mes date NOT NULL CHECK (extract(day from mes)=1),
 paridade text NOT NULL DEFAULT 'impar' CHECK(paridade IN ('par','impar')),
 turno text NOT NULL DEFAULT 'diurno' CHECK(turno IN ('diurno','noturno')),
 hora_inicio time NOT NULL DEFAULT '06:00',
 hora_fim time NOT NULL DEFAULT '18:00',
 ajustes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(ajustes)='object'),
 observacoes text NOT NULL DEFAULT '',
 removido boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(posto_id,colaborador_id,mes)
);
GRANT SELECT,INSERT,UPDATE ON public.posto_planilha TO authenticated;
GRANT ALL ON public.posto_planilha TO service_role;
ALTER TABLE public.posto_planilha ENABLE ROW LEVEL SECURITY;
CREATE POLICY planilha_ler ON public.posto_planilha FOR SELECT TO authenticated USING(public.can_manage_planilha(posto_id));
CREATE POLICY planilha_incluir ON public.posto_planilha FOR INSERT TO authenticated WITH CHECK(public.can_manage_planilha(posto_id) AND EXISTS(SELECT 1 FROM public.colaboradores c WHERE c.id=colaborador_id AND NOT c.arquivado AND c.situacao<>'desligado' AND (public.has_any_role(auth.uid(),ARRAY['admin','gestor','rh']::public.app_role[]) OR c.supervisor_id=auth.uid() OR EXISTS(SELECT 1 FROM public.postos p WHERE p.id=c.posto_id AND p.supervisor_id=auth.uid()))));
CREATE POLICY planilha_alterar ON public.posto_planilha FOR UPDATE TO authenticated USING(public.can_manage_planilha(posto_id)) WITH CHECK(public.can_manage_planilha(posto_id) AND EXISTS(SELECT 1 FROM public.colaboradores c WHERE c.id=colaborador_id AND (public.has_any_role(auth.uid(),ARRAY['admin','gestor','rh']::public.app_role[]) OR c.supervisor_id=auth.uid() OR EXISTS(SELECT 1 FROM public.postos p WHERE p.id=c.posto_id AND p.supervisor_id=auth.uid()))));
CREATE OR REPLACE FUNCTION public.validate_planilha() RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$ DECLARE k text; v jsonb; ultimo integer; BEGIN
 ultimo := extract(day from (new.mes + interval '1 month - 1 day'));
 FOR k,v IN SELECT key,value FROM jsonb_each(new.ajustes) LOOP
 IF k !~ '^[1-9][0-9]?$' THEN RAISE EXCEPTION 'Dia inválido'; END IF;
 IF k::integer > ultimo OR v NOT IN ('"T"'::jsonb,'"F"'::jsonb) THEN RAISE EXCEPTION 'Ajuste inválido'; END IF;
 END LOOP;
 new.updated_at:=now(); RETURN new; END $$;
CREATE TRIGGER validate_planilha BEFORE INSERT OR UPDATE ON public.posto_planilha FOR EACH ROW EXECUTE FUNCTION public.validate_planilha();
CREATE TRIGGER audit_planilha AFTER INSERT OR UPDATE ON public.posto_planilha FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE INDEX planilha_posto_mes ON public.posto_planilha(posto_id,mes);