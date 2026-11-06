create or replace function public.trg_notify_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator text; modulo text; link text; verbo text; titulo text; msg text;
  rec jsonb := coalesce(new.depois, new.antes);
  v_posto uuid; v_colab uuid; colab_nome text;
begin
  if new.tabela in ('notificacoes','comunicado_leituras','audit_log','colaborador_historico','curso_progresso','contracheque_visualizacoes') then
    return new;
  end if;
  modulo := case new.tabela
    when 'presencas' then 'Presença e faltas' when 'escalas' then 'Escalas' when 'escala_colaboradores' then 'Escalas'
    when 'posto_planilha' then 'Planilha de escala' when 'ferias' then 'Férias' when 'ocorrencias' then 'Solicitações'
    when 'colaboradores' then 'Colaboradores' when 'postos' then 'Postos' when 'comunicados' then 'Comunicados'
    when 'visitas' then 'Visitas' when 'inspecoes' then 'Inspeções' when 'documentos' then 'Documentos'
    when 'material_entregas' then 'Equipamentos e uniformes' when 'material_movimentacoes' then 'Estoque'
    when 'materiais' then 'Catálogo de materiais' else initcap(replace(new.tabela,'_',' ')) end;
  link := case
    when new.tabela = 'presencas' then '/presenca'
    when new.tabela in ('escalas','escala_colaboradores','posto_planilha') then '/escalas'
    when new.tabela = 'ferias' then '/ferias' when new.tabela = 'ocorrencias' then '/ocorrencias'
    when new.tabela = 'colaboradores' then '/colaboradores' when new.tabela = 'comunicados' then '/comunicados'
    when new.tabela = 'visitas' then '/visitas' when new.tabela = 'inspecoes' then '/inspecoes'
    when new.tabela like 'material%' then '/materiais' else null end;
  verbo := case upper(new.acao) when 'INSERT' then 'adicionou' when 'DELETE' then 'removeu' else 'alterou' end;
  select nome into ator from public.profiles where id = new.user_id;

  begin v_posto := nullif(rec->>'posto_id','')::uuid; exception when others then v_posto := null; end;
  begin v_colab := case when new.tabela = 'colaboradores' then nullif(rec->>'id','')::uuid else nullif(rec->>'colaborador_id','')::uuid end; exception when others then v_colab := null; end;
  if v_colab is not null then
    select c.nome, coalesce(v_posto, c.posto_id) into colab_nome, v_posto from public.colaboradores c where c.id = v_colab;
  end if;

  titulo := 'Atualização em ' || modulo;
  msg := coalesce(ator,'Sistema') || ' ' || verbo || ' um registro' || coalesce(' de ' || colab_nome, '');
  if new.tabela = 'presencas' and upper(new.acao) = 'UPDATE'
     and coalesce((new.depois->>'confirmado')::boolean,false) and not coalesce((new.antes->>'confirmado')::boolean,false) then
    titulo := 'Presença confirmada';
    msg := coalesce(ator,'Administração') || ' confirmou o lançamento' || coalesce(' de ' || colab_nome, '');
  end if;

  insert into public.notificacoes (user_id, titulo, mensagem, link)
  select distinct u.uid, titulo, msg, link from (
    select ur.user_id as uid from public.user_roles ur where ur.role in ('admin','rh','gestor')
    union
    select p.supervisor_id from public.postos p where p.id = v_posto and p.supervisor_id is not null
    union
    select unnest(p.supervisor_ids) from public.postos p where p.id = v_posto
  ) u
  join public.profiles pr on pr.id = u.uid and pr.status = 'ativo'
  where u.uid is distinct from new.user_id
    and not exists (
      select 1 from public.notificacoes n
      where n.user_id = u.uid and n.titulo = titulo and n.lida = false
        and n.created_at > now() - interval '2 minutes');
  return new;
exception when others then
  return new;
end $$;

revoke execute on function public.trg_notify_audit() from public, anon, authenticated;

drop trigger if exists notify_audit on public.audit_log;
create trigger notify_audit after insert on public.audit_log for each row execute function public.trg_notify_audit();