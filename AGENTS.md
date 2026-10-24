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
