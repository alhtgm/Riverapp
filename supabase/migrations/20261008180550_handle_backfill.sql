-- ============================================================
-- 既存ユーザーへの @handle 自動割り当て
-- いつ適用してもアプリの既存動作に影響しない（handle列はまだどこからも参照されない）。
-- 表示名からスラッグを生成し、重複時は連番を付与する。
-- 生成結果が短すぎる場合（日本語表示名など英数字が無い場合）は user+id先頭6桁にフォールバックする。
-- 本人は後からプロフィール設定で変更できる（P2で実装）。
-- ============================================================

do $$
declare
  v_profile record;
  v_base text;
  v_candidate text;
  v_suffix integer;
begin
  for v_profile in select id, display_name from profiles where handle is null loop
    v_base := lower(regexp_replace(coalesce(v_profile.display_name, ''), '[^a-zA-Z0-9]', '', 'g'));
    if length(v_base) < 3 then
      v_base := 'user' || substr(replace(v_profile.id::text, '-', ''), 1, 6);
    end if;
    v_base := substr(v_base, 1, 16);

    v_candidate := v_base;
    v_suffix := 1;
    while exists (select 1 from profiles where lower(handle) = lower(v_candidate)) loop
      v_suffix := v_suffix + 1;
      v_candidate := substr(v_base, 1, 20 - length(v_suffix::text) - 1) || '_' || v_suffix;
    end loop;

    update profiles set handle = v_candidate where id = v_profile.id;
  end loop;
end;
$$;
