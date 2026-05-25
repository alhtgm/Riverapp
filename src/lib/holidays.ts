// Parses Japan Cabinet Office holiday CSV (UTF-8, YYYY/M/D date format).
// Replace public/holidays.csv with the latest Cabinet Office file (converted to UTF-8) to update holidays.
// Source: https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html

export function parseHolidayCsv(csvText: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of csvText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('月日')) continue
    const comma = trimmed.indexOf(',')
    if (comma < 0) continue
    const datePart = trimmed.slice(0, comma).trim()
    const name = trimmed.slice(comma + 1).trim()
    const parts = datePart.split('/')
    if (parts.length !== 3) continue
    const [y, m, d] = parts.map(p => parseInt(p, 10))
    if (isNaN(y) || isNaN(m) || isNaN(d)) continue
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    map.set(key, name)
  }
  return map
}

export async function loadHolidays(): Promise<Map<string, string>> {
  try {
    const res = await fetch('/holidays.csv')
    if (!res.ok) return new Map()
    return parseHolidayCsv(await res.text())
  } catch {
    return new Map()
  }
}
