// 講義に参加したときに割り当てる色（自分用の表示色。あとから変更できる）
export const LECTURE_COLORS = ['#E16259', '#0891B2', '#16A34A', '#7C3AED', '#D97706', '#DB2777', '#0284C7', '#4F46E5']

export function pickLectureColor(index: number): string {
  return LECTURE_COLORS[((index % LECTURE_COLORS.length) + LECTURE_COLORS.length) % LECTURE_COLORS.length]
}
