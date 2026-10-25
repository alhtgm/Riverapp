import { useState } from 'react'
import { Button, Notice, Section } from '../ui/kit'
import { SegmentedButton, TextArea } from '../ui/m3'
import { useToast } from '../ui/Toast'
import { FEEDBACK_CATEGORY_LABEL, FEEDBACK_MAX_LENGTH, submitFeedback, type FeedbackCategory } from '../../lib/admin'

const PLACEHOLDER: Record<FeedbackCategory, string> = {
  bug: '例: 課題を追加したのにタイムラインに出てこない。どの画面で、何をしたらどうなったかを書いてもらえると助かります',
  request: '例: 課題ごとにメモを書けるようにしてほしい',
  other: '感想や質問など、なんでもどうぞ',
}

/** 設定の「開発者に連絡」タブ。送ったら欄を空にして、続けて送れるようにする。返事は受信箱に届く */
export default function FeedbackForm() {
  const { showToast } = useToast()
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = body.trim()

  const send = async () => {
    if (!trimmed) return
    setSending(true)
    setError(null)
    try {
      await submitFeedback(category, trimmed)
      showToast('開発者にメッセージを送りました。ありがとうございます')
      setBody('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Section title="開発者にメッセージを送る" description="アプリのバージョンとブラウザの種類も一緒に送られます">
      <SegmentedButton
        label="メッセージの種類"
        block
        value={category}
        onChange={setCategory}
        options={(Object.keys(FEEDBACK_CATEGORY_LABEL) as FeedbackCategory[]).map(k => ({ key: k, label: FEEDBACK_CATEGORY_LABEL[k] }))}
      />
      <TextArea
        label="内容"
        required
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={FEEDBACK_MAX_LENGTH}
        rows={8}
        placeholder={PLACEHOLDER[category]}
        supportingText={`${body.length} / ${FEEDBACK_MAX_LENGTH}文字`}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" loading={sending} disabled={!trimmed} onClick={() => void send()}>送る</Button>
      </div>
    </Section>
  )
}
