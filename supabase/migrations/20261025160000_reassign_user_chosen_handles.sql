-- ============================================================
-- 自分で決めたユーザーID（と、自動で決める仕組みより前に付いたID）を、自動で決めたIDに振り直す
-- - 自動で決めたID = generate_handle() の形（読み間違えやすい文字を除いた英小文字と数字で8文字）
-- - その形でないIDだけを振り直す。フレンドやパーティーは内部のIDでつながっているので影響しない
-- - 本人の受信箱に「ユーザーIDが変わりました」（旧→新）を届ける
-- profiles_fixed_handle トリガーは、ログイン中の利用者からの変更だけを拒むので、ここでは書き換えられる
-- 1人ずつ振り直す（まとめて1つの文で作ると、同じ文の中で作ったID同士の重複を generate_handle() が見落とすため）
-- ============================================================

do $$
declare
  r record;
  v_new text;
begin
  for r in
    select id, handle from profiles
    where handle !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{8}$'
  loop
    v_new := generate_handle();
    update profiles set handle = v_new where id = r.id;
    insert into notifications (user_id, type, payload)
    values (r.id, 'handle_reassigned', jsonb_build_object('old_handle', r.handle, 'new_handle', v_new));
  end loop;
end;
$$;
