CREATE TABLE public.comunicados (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 titulo text NOT NULL CHECK (length(btrim(titulo)) > 0),
 mensagem text NOT NULL CHECK (length(btrim(mensagem)) > 0),
 publicado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 arquivado boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.comunicados TO authenticated;
GRANT ALL ON public.comunicados TO service_role;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
CREATE POLICY comunicados_leitura ON public.comunicados FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (NOT arquivado AND public.has_any_role(auth.uid(), ARRAY['gestor','rh','supervisor','colaborador']::public.app_role[])));
CREATE POLICY comunicados_publicar ON public.comunicados FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND publicado_por = auth.uid());
CREATE POLICY comunicados_arquivar ON public.comunicados FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER audit_comunicados AFTER INSERT OR UPDATE OR DELETE ON public.comunicados FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TABLE public.comunicado_leituras (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 comunicado_id uuid NOT NULL REFERENCES public.comunicados(id),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (comunicado_id,user_id)
);
GRANT SELECT, INSERT ON public.comunicado_leituras TO authenticated;
GRANT ALL ON public.comunicado_leituras TO service_role;
ALTER TABLE public.comunicado_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY leituras_consultar ON public.comunicado_leituras FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR (user_id = auth.uid() AND public.has_any_role(auth.uid(),ARRAY['gestor','rh','supervisor','colaborador']::public.app_role[])));
CREATE POLICY leituras_confirmar ON public.comunicado_leituras FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_any_role(auth.uid(),ARRAY['admin','gestor','rh','supervisor','colaborador']::public.app_role[]) AND EXISTS (SELECT 1 FROM public.comunicados c WHERE c.id = comunicado_id AND NOT c.arquivado));
CREATE TRIGGER audit_comunicado_leituras AFTER INSERT OR UPDATE OR DELETE ON public.comunicado_leituras FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE OR REPLACE FUNCTION public.notify_comunicado() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 INSERT INTO public.notificacoes(user_id,titulo,mensagem,link)
 SELECT p.id,'Novo comunicado',new.titulo,'/comunicados' FROM public.profiles p
 WHERE p.status = 'ativo' AND p.id <> new.publicado_por AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id);
 RETURN new;
END;
$$;
CREATE TRIGGER notify_comunicado AFTER INSERT ON public.comunicados FOR EACH ROW EXECUTE FUNCTION public.notify_comunicado();