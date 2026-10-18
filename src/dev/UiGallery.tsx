/**
 * 共通部品の確認用ページ（開発中だけ /dev/ui で開ける。本番には含まれない）
 * M3 の部品をすべて並べ、ライト/ダークや画面幅を変えて見比べるためのもの。
 */
import { useState, type ReactNode } from 'react'
import {
  BottomSheet, Button, Card, Chip, Dialog, Fab, IconButton, NavigationBar, NavigationRail,
  SegmentedButton, SelectField, Snackbar, TextArea, TextField, type NavDestination,
} from '../components/ui/m3'
import { useSnackbar } from '../components/ui/useSnackbar'
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme'
import { useWindowSizeClass } from '../theme/useWindowSizeClass'

const Icon = ({ d }: { d: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const icons = {
  plus: <Icon d="M12 5v14M5 12h14" />,
  close: <Icon d="M6 6l12 12M18 6L6 18" />,
  menu: <Icon d="M4 7h16M4 12h16M4 17h16" />,
  timeline: <Icon d="M4 6h10M7 12h13M4 18h8" />,
  people: <Icon d="M9 11a3 3 0 100-6 3 3 0 000 6zM3.5 19c.6-3 3-4.5 5.5-4.5s4.9 1.5 5.5 4.5M16 11a2.5 2.5 0 100-5M17 14.5c2 .3 3.3 1.8 3.6 4.5" />,
  inbox: <Icon d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 004 0" />,
  settings: <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3L17 7M7 17l-1.7 1.7M18.7 18.7L17 17M7 7L5.3 5.3" />,
  trash: <Icon d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  calendar: <Icon d="M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v3M15.5 3.5v3" />,
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={{ padding: 'var(--space-6) 0', borderBottom: '1px solid var(--border)' }}>
      <h2 className="type-title-large" style={{ margin: '0 0 var(--space-1)' }}>{title}</h2>
      {note && <p className="type-body-medium" style={{ margin: '0 0 var(--space-4)', color: 'var(--text-secondary)' }}>{note}</p>}
      {children}
    </section>
  )
}

const Row = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>{children}</div>
)

type Dest = 'timeline' | 'people' | 'inbox' | 'settings'
const destinations: NavDestination<Dest>[] = [
  { key: 'timeline', label: 'タイムライン', icon: icons.timeline },
  { key: 'people', label: '仲間', icon: icons.people },
  { key: 'inbox', label: '受信箱', icon: icons.inbox, badge: 3 },
  { key: 'settings', label: '設定', icon: icons.settings, badge: true },
]

export default function UiGallery() {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme)
  const [dialog, setDialog] = useState<'basic' | 'icon' | null>(null)
  const [sheet, setSheet] = useState(false)
  const [filters, setFilters] = useState<Set<string>>(new Set(['進行中']))
  const [tags, setTags] = useState(['ゼミ', 'サークル', 'アルバイト'])
  const [dest, setDest] = useState<Dest>('timeline')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'single' | 'recurring' | 'template'>('single')
  const snackbar = useSnackbar()
  const size = useWindowSizeClass()

  const switchTheme = (mode: ThemeMode) => { applyTheme(mode); setTheme(mode) }
  const toggleFilter = (f: string) => setFilters(prev => {
    const next = new Set(prev)
    if (next.has(f)) next.delete(f)
    else next.add(f)
    return next
  })

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2) var(--space-3)',
        padding: 'var(--space-3) var(--space-screen-margin)', background: 'var(--header-glass)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <h1 className="type-title-large" style={{ margin: 0, flex: '1 1 200px' }}>部品の確認（/dev/ui）</h1>
        <span className="type-label-medium" style={{ color: 'var(--text-secondary)' }}>幅: {size}</span>
        <Chip selected={theme === 'light'} onClick={() => switchTheme('light')}>ライト</Chip>
        <Chip selected={theme === 'dark'} onClick={() => switchTheme('dark')}>ダーク</Chip>
      </header>

      <main style={{ maxWidth: 1040, margin: '0 auto', padding: '0 var(--space-screen-margin) 160px' }}>
        <Section title="ボタン" note="高さ 40px・角は完全な丸。filled は 1 画面に基本 1 つ。押す・乗せる・Tab で選ぶと薄い色が重なる">
          <Row>
            <Button>保存する</Button>
            <Button variant="tonal">下書きに保存</Button>
            <Button variant="outlined">プレビュー</Button>
            <Button variant="text">キャンセル</Button>
          </Row>
          <Row>
            <Button icon={icons.plus}>課題を追加</Button>
            <Button variant="tonal" icon={icons.calendar}>日付を選ぶ</Button>
            <Button loading>保存中</Button>
            <Button disabled>使えない</Button>
            <Button variant="outlined" disabled>使えない</Button>
          </Row>
          <Row>
            <Button danger icon={icons.trash}>削除する</Button>
            <Button danger variant="tonal">講義から退出</Button>
            <Button danger variant="outlined">ブロック</Button>
            <Button danger variant="text">取り消す</Button>
          </Row>
          <div style={{ maxWidth: 360 }}><Button block>幅いっぱいのボタン</Button></div>
        </Section>

        <Section title="アイコンボタン" note="見た目 40px、押せる範囲は 48px。文字がないので読み上げ用の名前を必ず付ける">
          <Row>
            <IconButton label="メニュー">{icons.menu}</IconButton>
            <IconButton label="追加" variant="filled">{icons.plus}</IconButton>
            <IconButton label="カレンダー" variant="tonal">{icons.calendar}</IconButton>
            <IconButton label="閉じる" variant="outlined">{icons.close}</IconButton>
            <IconButton label="選択中" selected>{icons.settings}</IconButton>
            <IconButton label="使えない" disabled>{icons.trash}</IconButton>
          </Row>
        </Section>

        <Section title="FAB" note="その画面でいちばん大事な操作 1 つだけ（River では「課題を追加」）">
          <Row>
            <Fab label="課題を追加" icon={icons.plus} size="small" />
            <Fab label="課題を追加" icon={icons.plus} />
            <Fab label="課題を追加" icon={icons.plus} size="large" />
            <Fab label="課題を追加" icon={icons.plus} variant="tonal" />
            <Fab label="課題を追加" icon={icons.plus} extended />
          </Row>
        </Section>

        <Section title="カード" note="角 12px。elevated（浮かせる）/ filled（背景色）/ outlined（枠線）。押せるカードにもできる">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            {(['elevated', 'filled', 'outlined'] as const).map(v => (
              <Card key={v} variant={v}>
                <div className="type-title-medium">情報科学（{v}）</div>
                <div className="type-body-medium" style={{ color: 'var(--text-secondary)' }}>2026年度 後期・課題 4 件</div>
              </Card>
            ))}
            <Card variant="outlined" onClick={() => snackbar.show({ text: 'カードを押しました' })}>
              <div className="type-title-medium">押せるカード</div>
              <div className="type-body-medium" style={{ color: 'var(--text-secondary)' }}>押す・乗せると色が重なる</div>
            </Card>
          </div>
        </Section>

        <Section title="入力欄" note="outlined に統一。高さ 56px・角 4px。ラベル・補足文・エラーを持てる">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-6) var(--space-4)' }}>
            <TextField label="課題のタイトル" placeholder="未入力の場合「課題」" value={title} onChange={e => setTitle(e.target.value)} supportingText="講義の参加者全員に共有されます" />
            <TextField label="締切日" type="date" required />
            <TextField label="招待コード" defaultValue="ABC" error="8文字のコードを入れてください" />
            <SelectField label="講義" defaultValue="info">
              <option value="info">情報科学</option>
              <option value="linear">線形代数</option>
            </SelectField>
            <TextField label="使えない入力欄" disabled defaultValue="編集できません" />
            <TextArea label="メモ" placeholder="自分だけが見られるメモ" />
          </div>
        </Section>

        <Section title="チップ" note="高さ 32px・角 8px。絞り込み（選ぶとチェック）・入力済みの項目（× で外す）・近道">
          <Row>
            {['未着手', '進行中', '完了', '提出済み', '期限切れ'].map(f => (
              <Chip key={f} selected={filters.has(f)} onClick={() => toggleFilter(f)}>{f}</Chip>
            ))}
          </Row>
          <Row>
            {tags.map(t => (
              <Chip key={t} onRemove={() => setTags(prev => prev.filter(x => x !== t))} removeLabel={`${t}を外す`}>{t}</Chip>
            ))}
            {tags.length === 0 && <Button variant="text" onClick={() => setTags(['ゼミ', 'サークル', 'アルバイト'])}>元に戻す</Button>}
          </Row>
          <Row>
            <Chip icon={icons.calendar}>今日へ移動</Chip>
            <Chip disabled>使えない</Chip>
          </Row>
        </Section>

        <Section title="セグメントボタン" note="フォームの中で 2〜5 個から 1 つを選ぶ。高さ 40px・選ばれたものにチェック">
          <Row>
            <SegmentedButton label="追加のしかた" value={mode} onChange={setMode}
              options={[{ key: 'single', label: '単発' }, { key: 'recurring', label: '繰り返し' }, { key: 'template', label: 'テンプレート' }]} />
          </Row>
        </Section>

        <Section title="ダイアログとボトムシート" note="ダイアログは角 28px・右下にボタン（確認や短い入力）。ボトムシートは下から出る（選択肢や詳細）。Esc・外側を押すと閉じる">
          <Row>
            <Button variant="tonal" onClick={() => setDialog('basic')}>ダイアログを開く</Button>
            <Button variant="tonal" onClick={() => setDialog('icon')}>アイコン付きダイアログ</Button>
            <Button variant="tonal" onClick={() => setSheet(true)}>ボトムシートを開く</Button>
          </Row>
        </Section>

        <Section title="スナックバー" note="保存・削除などの結果を画面下に短く知らせる。操作付きは長めに出る">
          <Row>
            <Button variant="tonal" onClick={() => snackbar.show({ text: '課題を保存しました' })}>知らせる</Button>
            <Button variant="tonal" onClick={() => snackbar.show({ text: '課題を削除しました', action: { label: '元に戻す', onClick: () => snackbar.show({ text: '元に戻しました' }) } })}>操作付きで知らせる</Button>
          </Row>
        </Section>

        <Section title="ナビゲーション" note="スマホ幅（600px 未満）は下部のバー、それより広いと左側のレール。実際の配置はステップ 4 で決める">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)', alignItems: 'start' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--shape-md)', overflow: 'hidden' }}>
              <div className="type-label-medium" style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--text-secondary)' }}>ナビゲーションバー（compact）</div>
              <NavigationBar items={destinations} value={dest} onChange={setDest} label="見本のバー" />
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--shape-md)', overflow: 'hidden', height: 420 }}>
              <NavigationRail items={destinations} value={dest} onChange={setDest} label="見本のレール" fab={<Fab label="課題を追加" icon={icons.plus} />} />
            </div>
          </div>
        </Section>

        <Section title="文字の大きさ" note="M3 の 15 段階（書体は Noto Sans JP）">
          {(['display-small', 'headline-large', 'headline-medium', 'headline-small', 'title-large', 'title-medium', 'title-small', 'body-large', 'body-medium', 'body-small', 'label-large', 'label-medium', 'label-small'] as const).map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <span className="type-label-small" style={{ width: 120, flexShrink: 0, color: 'var(--text-tertiary)' }}>{r}</span>
              <span className={`type-${r}`}>課題のタイムライン River</span>
            </div>
          ))}
        </Section>

        <Section title="角の丸みと影">
          <Row>
            {(['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const).map(s => (
              <div key={s} style={{ width: 72, height: 56, borderRadius: `var(--shape-${s})`, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="type-label-medium">{s}</div>
            ))}
          </Row>
          <Row>
            {[0, 1, 2, 3, 4, 5].map(l => (
              <div key={l} style={{ width: 72, height: 56, borderRadius: 'var(--shape-md)', background: 'var(--surface)', boxShadow: `var(--elevation-${l})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="type-label-medium">Lv{l}</div>
            ))}
          </Row>
        </Section>
      </main>

      {size === 'compact' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <NavigationBar items={destinations} value={dest} onChange={setDest} label="画面下のバー（見本）" />
        </div>
      )}

      <Dialog
        open={dialog === 'basic'}
        onClose={() => setDialog(null)}
        title="この課題を削除しますか？"
        actions={<>
          <Button variant="text" onClick={() => setDialog(null)}>やめる</Button>
          <Button variant="text" danger onClick={() => { setDialog(null); snackbar.show({ text: '削除しました', action: { label: '元に戻す', onClick: () => {} } }) }}>削除する</Button>
        </>}
      >
        「レポート1」を削除します。講義の参加者全員のタイムラインからも消えます。
      </Dialog>
      <Dialog
        open={dialog === 'icon'}
        onClose={() => setDialog(null)}
        icon={icons.calendar}
        title="新しい学期を始めますか？"
        actions={<>
          <Button variant="text" onClick={() => setDialog(null)}>やめる</Button>
          <Button variant="text" onClick={() => setDialog(null)}>始める</Button>
        </>}
      >
        2027年度 前期の空のシートが開きます。今までの学期はメニューから切り替えられます。
      </Dialog>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="講義を選ぶ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {['情報科学', '線形代数', '英語コミュニケーション'].map(l => (
            <Card key={l} variant="filled" onClick={() => { setSheet(false); snackbar.show({ text: `${l}を選びました` }) }}>
              <span className="type-body-large">{l}</span>
            </Card>
          ))}
        </div>
      </BottomSheet>
      <Snackbar message={snackbar.message} onClose={snackbar.close} />
    </div>
  )
}
