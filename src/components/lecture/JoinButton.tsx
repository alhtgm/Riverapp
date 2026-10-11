import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import { pickLectureColor } from '../../lib/colors'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/kit'
import type { LectureSummary } from '../../types'

interface Props {
  lecture: LectureSummary
  /** 状態が変わったら呼ぶ（一覧の再取得用） */
  onChanged: () => void
  /** 「参加中」を押したとき */
  onOpenLecture: (lectureId: string) => void
}

/**
 * 参加ボタン（5章）。プロフィールとパーティーのホーム画面で共通。
 *   未参加・申請オフ → 参加する / 未参加・申請オン → 参加申請
 *   申請中 → 申請中（押すと確認のうえ取り下げ）/ 参加済み → 参加中（講義の画面）/ 除外済み → 表示しない
 */
export default function JoinButton({ lecture, onChanged, onOpenLecture }: Props) {
  const { showToast } = useToast()
  const fetchAll = useStore(s => s.fetchAll)
  const subjectCount = useStore(s => s.subjects.length)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e: unknown) {
      showToast(toMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  switch (lecture.my_status) {
    case 'excluded':
      return null

    case 'participant':
      return <Button size="sm" onClick={() => onOpenLecture(lecture.id)}>参加中 ›</Button>

    case 'pending':
      if (confirmCancel) {
        return (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>やめる</Button>
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              onClick={() => run(async () => {
                const { error } = await supabase
                  .from('lecture_apply_requests')
                  .update({ status: 'cancelled' })
                  .eq('lecture_id', lecture.id)
                  .eq('status', 'pending')
                if (error) throw error
                setConfirmCancel(false)
                showToast('参加申請を取り下げました')
                onChanged()
              })}
            >
              申請を取り下げる
            </Button>
          </span>
        )
      }
      return (
        <Button size="sm" onClick={() => setConfirmCancel(true)} title="押すと申請を取り下げられます" style={{ color: 'var(--text-tertiary)' }}>
          申請中
        </Button>
      )

    default:
      return (
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          onClick={() => run(async () => {
            if (lecture.apply_open) {
              const { error } = await supabase.rpc('request_join_lecture', { p_lecture_id: lecture.id })
              if (error) throw error
              showToast('参加申請を送りました。参加者が承認すると参加できます')
            } else {
              const { error } = await supabase.rpc('join_lecture', {
                p_lecture_id: lecture.id,
                p_color: pickLectureColor(subjectCount),
              })
              if (error) throw error
              showToast(`「${lecture.title}」に参加しました。課題がタイムラインに追加されます`)
              await fetchAll()
            }
            onChanged()
          })}
        >
          {lecture.apply_open ? '参加申請' : '参加する'}
        </Button>
      )
  }
}
