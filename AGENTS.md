<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Roles live in `user_roles` and are checked in RLS via `has_role`/`has_any_role` (which also require an active profile); UI module visibility mirrors this in `src/lib/labels.ts` — keep both in sync.
- Privileged user management (create user, change role/status, reset password) goes through admin-checked server functions in `src/lib/users.functions.ts`; never from the browser client.
- Data changes are audited by DB triggers (`audit_log`, `colaborador_historico`); new tables should attach `audit_trigger`.
- Official announcements use `comunicados` with immutable per-user receipts in `comunicado_leituras`; archive instead of deleting to preserve publication and reading audit history.
- Keep the shared workspace layout, grouped navigation and searchable module list together; new modules must join both navigation and its group so additions preserve the established workspace.
- Monthly per-post rosters use `posto_planilha`, independent of home-post transfers and recurring `escalas` templates; soft-remove assignments and audit edits to retain each month's history without changing GPS attendance or employee records.
- Roster patterns use `escala_tipo` with shared options for employee registration and export; cell swaps run atomically through the RLS-enforced `trocar_plantao` function to avoid partially saved exchanges.
- The primary roster view groups whole monthly assignments by pattern and shift; operational positions belong to each assignment, and whole-person moves use a single audited row update without changing employee records or daily overrides. Export mirrors those groups while retaining the monthly grid as a secondary sheet.
- Equipment and uniform catalog entries are archived, while employee deliveries remain immutable except for a single audited return; post-scoped RLS controls supervisor access and the Excel export follows the visible delivery filters.
- Inspection checklists: templates in checklist_modelos (archived, never deleted); inspecoes are insert-only with post-scoped RLS via can_manage_planilha so audit history stays immutable.
- Attendance starts scheduled workers as present and shows roster days off as "Folga pela escala" (including parity and daily overrides), without time-based automatic absences; supervisors and managers record only manual exceptions, admin/RH confirm them, justified absences require a linked private document, and an optional same-day covering employee is stored on the presence row. Function colors map by function name in src/lib/funcao-cores.ts.
- Live updates: a single app-wide Realtime channel (src/components/live-sync.tsx, mounted in the authenticated layout header) invalidates queries on changes; new tables shown in screens must join the supabase_realtime publication and that table list, so every screen stays current without per-page channels.
- Stock items carry a display group and a per-size minimum; "Comprar" is derived (stock below minimum), never stored, so it stays correct as movements change.
- Per-supervisor function restriction: optional rows in supervisor_funcoes limit which colaboradores a supervisor reads (via supervisor_funcao_ok in colaboradores RLS); no rows = no restriction.
