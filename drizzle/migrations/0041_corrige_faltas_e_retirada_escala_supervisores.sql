CREATE OR REPLACE FUNCTION public.trg_notify_falta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nome_colaborador text;
BEGIN
  IF NEW.status = 'falta' THEN
    SELECT c.nome INTO nome_colaborador FROM public.colaboradores c WHERE c.id = NEW.colaborador_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      SELECT ur.user_id, 'Falta registrada',
        coalesce(nome_colaborador, 'Colaborador') || ' registrou falta em ' || to_char(NEW.data, 'DD/MM/YYYY'), '/presenca'
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id AND p.status = 'ativo'
      WHERE ur.role IN ('admin','gestor','rh');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.can_manage_planilha_colaborador(_posto_id uuid, _colaborador_id uuid, _exigir_ativo boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_planilha(_posto_id)
    AND EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = _colaborador_id
        AND (NOT _exigir_ativo OR (NOT c.arquivado AND c.situacao <> 'desligado'))
        AND (
          public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[])
          OR (public.has_role(auth.uid(), 'supervisor') AND public.supervisor_funcao_ok(c.funcao_id, auth.uid()))
        )
    )
$$;
REVOKE ALL ON FUNCTION public.can_manage_planilha_colaborador(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_planilha_colaborador(uuid,uuid,boolean) TO authenticated;

DROP POLICY IF EXISTS planilha_ler ON public.posto_planilha;
CREATE POLICY planilha_ler ON public.posto_planilha FOR SELECT TO authenticated
USING (public.can_manage_planilha_colaborador(posto_id, colaborador_id, false));

DROP POLICY IF EXISTS planilha_incluir ON public.posto_planilha;
CREATE POLICY planilha_incluir ON public.posto_planilha FOR INSERT TO authenticated
WITH CHECK (public.can_manage_planilha_colaborador(posto_id, colaborador_id, true));

DROP POLICY IF EXISTS planilha_alterar ON public.posto_planilha;
CREATE POLICY planilha_alterar ON public.posto_planilha FOR UPDATE TO authenticated
USING (public.can_manage_planilha_colaborador(posto_id, colaborador_id, false))
WITH CHECK (public.can_manage_planilha_colaborador(posto_id, colaborador_id, false));

CREATE OR REPLACE FUNCTION public.trocar_plantao(origem uuid, destino uuid, dia_origem integer, dia_destino integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='public' AS $$
DECLARE a public.posto_planilha; b public.posto_planilha; sa text; sb text; wa integer; wb integer;
BEGIN
 PERFORM id FROM public.posto_planilha WHERE id IN (origem,destino) ORDER BY id FOR UPDATE;
 SELECT * INTO a FROM public.posto_planilha WHERE id=origem AND NOT removido;
 SELECT * INTO b FROM public.posto_planilha WHERE id=destino AND NOT removido;
 IF a.id IS NULL OR b.id IS NULL OR a.posto_id<>b.posto_id OR a.mes<>b.mes OR NOT public.can_manage_planilha_colaborador(a.posto_id,a.colaborador_id,false) OR NOT public.can_manage_planilha_colaborador(b.posto_id,b.colaborador_id,false) THEN RAISE EXCEPTION 'Troca não permitida'; END IF;
 IF dia_origem<1 OR dia_destino<1 OR dia_origem>extract(day from(a.mes+interval '1 month - 1 day')) OR dia_destino>extract(day from(b.mes+interval '1 month - 1 day')) THEN RAISE EXCEPTION 'Dia inválido'; END IF;
 wa:=extract(isodow from(a.mes+dia_origem-1)); wb:=extract(isodow from(b.mes+dia_destino-1));
 sa:=coalesce(a.ajustes->>dia_origem::text,CASE WHEN coalesce(a.escala_tipo,a.paridade)='par' AND dia_origem%2=0 OR coalesce(a.escala_tipo,a.paridade)='impar' AND dia_origem%2=1 OR a.escala_tipo='5x2' AND wa<=5 OR a.escala_tipo='6x1' AND wa<=6 OR a.escala_tipo='diaria' THEN 'T' ELSE 'F' END);
 sb:=coalesce(b.ajustes->>dia_destino::text,CASE WHEN coalesce(b.escala_tipo,b.paridade)='par' AND dia_destino%2=0 OR coalesce(b.escala_tipo,b.paridade)='impar' AND dia_destino%2=1 OR b.escala_tipo='5x2' AND wb<=5 OR b.escala_tipo='6x1' AND wb<=6 OR b.escala_tipo='diaria' THEN 'T' ELSE 'F' END);
 IF origem=destino THEN UPDATE public.posto_planilha SET ajustes=jsonb_set(jsonb_set(ajustes,ARRAY[dia_origem::text],to_jsonb(sb)),ARRAY[dia_destino::text],to_jsonb(sa)) WHERE id=origem;
 ELSE UPDATE public.posto_planilha SET ajustes=jsonb_set(ajustes,ARRAY[dia_origem::text],to_jsonb(sb)) WHERE id=origem; UPDATE public.posto_planilha SET ajustes=jsonb_set(ajustes,ARRAY[dia_destino::text],to_jsonb(sa)) WHERE id=destino; END IF;
END $$;
REVOKE ALL ON FUNCTION public.trocar_plantao(uuid,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trocar_plantao(uuid,uuid,integer,integer) TO authenticated;