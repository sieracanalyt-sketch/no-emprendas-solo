-- ──────────────────────────────────────────────────────────────────────────────
-- FIX: "Quitar del equipo" no hacía nada.
--
-- workflow_roles tiene RLS activo y políticas de SELECT / INSERT / UPDATE, pero
-- NUNCA se creó la de DELETE. Con RLS activo y sin política, el DELETE no da
-- error: simplemente no encuentra filas que borrar y devuelve éxito con 0 filas.
-- Resultado: la UI quitaba al miembro de forma optimista y al recargar volvía.
--
-- Se añade la política siguiendo el mismo patrón permisivo que las otras tres
-- (cualquier usuario autenticado gestiona el equipo del workspace).
-- ──────────────────────────────────────────────────────────────────────────────

drop policy if exists wf_roles_delete on public.workflow_roles;

create policy wf_roles_delete
  on public.workflow_roles
  for delete
  to public
  using (auth.uid() is not null);
