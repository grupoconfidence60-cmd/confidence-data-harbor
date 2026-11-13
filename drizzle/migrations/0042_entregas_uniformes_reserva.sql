ALTER TABLE public.material_entregas ALTER COLUMN posto_id DROP NOT NULL;
COMMENT ON COLUMN public.material_entregas.posto_id IS 'NULL identifica entrega para Reserva, sem alterar o cadastro do colaborador.';
CREATE OR REPLACE FUNCTION public.can_manage_material_reserva(_colaborador_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[]) OR (public.has_role(auth.uid(),'supervisor') AND EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id=_colaborador_id AND public.supervisor_funcao_ok(c.funcao_id,auth.uid()) AND (c.posto_id IS NULL OR public.supervisiona_posto(c.posto_id,auth.uid()))));
$$;
REVOKE ALL ON FUNCTION public.can_manage_material_reserva(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_material_reserva(uuid) TO authenticated;
DROP POLICY entregas_read ON public.material_entregas;
CREATE POLICY entregas_read ON public.material_entregas FOR SELECT TO authenticated USING ((posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND public.can_manage_material_reserva(colaborador_id)));
DROP POLICY entregas_insert ON public.material_entregas;
CREATE POLICY entregas_insert ON public.material_entregas FOR INSERT TO authenticated WITH CHECK (registrado_por=auth.uid() AND ((posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND public.can_manage_material_reserva(colaborador_id))));
DROP POLICY entregas_update ON public.material_entregas;
CREATE POLICY entregas_update ON public.material_entregas FOR UPDATE TO authenticated USING ((posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND public.can_manage_material_reserva(colaborador_id))) WITH CHECK ((posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND public.can_manage_material_reserva(colaborador_id)));
DROP POLICY "mov read" ON public.material_movimentacoes;
CREATE POLICY "mov read" ON public.material_movimentacoes FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['admin','gestor','rh']::public.app_role[]) OR (posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND colaborador_id IS NOT NULL AND public.can_manage_material_reserva(colaborador_id)));
DROP POLICY "mov insert" ON public.material_movimentacoes;
CREATE POLICY "mov insert" ON public.material_movimentacoes FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin','rh']::public.app_role[]) OR (tipo NOT IN ('entrada','baixa') AND ((posto_id IS NOT NULL AND public.can_manage_planilha(posto_id)) OR (posto_id IS NULL AND colaborador_id IS NOT NULL AND public.can_manage_material_reserva(colaborador_id)))));
CREATE OR REPLACE FUNCTION public.validate_material_mov() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.registrado_por:=auth.uid(); NEW.created_at:=now();
 IF NEW.registrado_por IS NULL THEN RAISE EXCEPTION 'Usuário não identificado'; END IF;
 IF NEW.tipo IN ('entrega','devolucao','troca') THEN
  IF NEW.colaborador_id IS NULL THEN RAISE EXCEPTION 'Informe o colaborador'; END IF;
  IF NEW.posto_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id=NEW.colaborador_id AND c.posto_id IS NULL) AND NEW.tipo <> 'devolucao' THEN RAISE EXCEPTION 'Selecione o posto do colaborador. Reserva é destinada a colaboradores sem posto.'; END IF;
 END IF;
 IF NEW.tipo IN ('entrega','baixa','troca') AND public.material_saldo(NEW.material_id)<NEW.quantidade THEN RAISE EXCEPTION 'Estoque insuficiente para este material'; END IF;
 RETURN NEW;
END $$;