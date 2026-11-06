CREATE OR REPLACE FUNCTION public.notificar_ferias_gestao(_colab uuid, _titulo text, _msg text, _autor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _posto uuid; _sup uuid;
BEGIN
  SELECT posto_id, supervisor_id INTO _posto, _sup FROM public.colaboradores WHERE id = _colab;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
  SELECT DISTINCT p.id, _titulo, _msg, '/ferias'
    FROM public.profiles p
   WHERE p.status = 'ativo' AND p.id IS DISTINCT FROM _autor
     AND ( EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','gestor','rh'))
        OR (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'supervisor')
            AND (p.id = _sup OR (_posto IS NOT NULL AND public.supervisiona_posto(_posto, p.id)))) );
END $$;
REVOKE ALL ON FUNCTION public.notificar_ferias_gestao(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_ferias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nome text; periodo text; rotulo text;
BEGIN
  SELECT c.nome INTO nome FROM public.colaboradores c WHERE c.id = new.colaborador_id;
  nome := coalesce(nome,'Colaborador');
  periodo := to_char(new.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(new.data_fim,'DD/MM/YYYY');
  rotulo := CASE WHEN new.tipo = 'abono' THEN 'abono pecuniário' ELSE 'férias' END;
  IF tg_op = 'INSERT' AND new.status = 'solicitada' THEN
    PERFORM public.notificar_ferias_gestao(new.colaborador_id, 'Pedido de ' || rotulo, nome || ' — ' || periodo, auth.uid());
  ELSIF tg_op = 'INSERT' AND new.status = 'aprovada' THEN
    PERFORM public.notificar_ferias_gestao(new.colaborador_id, 'Férias agendadas', nome || ' — ' || periodo, auth.uid());
  ELSIF tg_op = 'UPDATE' AND new.status IS DISTINCT FROM old.status AND new.status IN ('aprovada','recusada') THEN
    PERFORM public.notificar_ferias_gestao(new.colaborador_id,
      'Pedido de ' || rotulo || CASE WHEN new.status = 'aprovada' THEN ' aprovado' ELSE ' recusado' END, nome || ' — ' || periodo, auth.uid());
  ELSIF tg_op = 'UPDATE' AND new.cobertura IS DISTINCT FROM old.cobertura THEN
    PERFORM public.notificar_ferias_gestao(new.colaborador_id, 'Cobertura de férias',
      CASE WHEN new.cobertura IS NULL THEN 'Cobertura removida para ' || nome
           ELSE new.cobertura || ' vai cobrir ' || nome || ' (' || periodo || ')' END, auth.uid());
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.rotina_ferias_diaria()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; r record; n integer := 0;
BEGIN
  FOR r IN SELECT f.*, c.nome FROM public.ferias f JOIN public.colaboradores c ON c.id = f.colaborador_id
            WHERE f.tipo = 'ferias' AND f.status = 'aprovada' AND f.data_inicio <= hoje AND f.data_fim >= hoje AND NOT c.arquivado LOOP
    UPDATE public.ferias SET status = 'em_gozo' WHERE id = r.id;
    UPDATE public.colaboradores SET situacao = 'ferias' WHERE id = r.colaborador_id AND situacao = 'ativo';
    PERFORM public.notificar_ferias_gestao(r.colaborador_id, 'Saiu de férias',
      r.nome || ' está de férias até ' || to_char(r.data_fim,'DD/MM/YYYY') || '. Cobertura: ' || coalesce(r.cobertura,'não informada'));
    n := n + 1;
  END LOOP;
  FOR r IN SELECT f.*, c.nome FROM public.ferias f JOIN public.colaboradores c ON c.id = f.colaborador_id
            WHERE f.tipo = 'ferias' AND f.status IN ('aprovada','em_gozo') AND f.data_fim < hoje LOOP
    PERFORM public.notificar_ferias_gestao(r.colaborador_id, 'Voltou de férias',
      r.nome || ' retornou das férias (' || to_char(r.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(r.data_fim,'DD/MM/YYYY') || ').');
    n := n + 1;
  END LOOP;
  FOR r IN SELECT f.*, c.nome FROM public.ferias f JOIN public.colaboradores c ON c.id = f.colaborador_id
            WHERE f.tipo = 'ferias' AND f.status = 'aprovada' AND f.data_inicio = hoje + 3 AND f.cobertura IS NULL LOOP
    PERFORM public.notificar_ferias_gestao(r.colaborador_id, 'Férias sem cobertura',
      r.nome || ' sai de férias em ' || to_char(r.data_inicio,'DD/MM/YYYY') || ' e ainda não tem cobertura definida.');
  END LOOP;
  PERFORM public.encerrar_ferias_vencidas();
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.rotina_ferias_diaria() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('encerrar-ferias-vencidas', '5 3 * * *', 'SELECT public.rotina_ferias_diaria()');