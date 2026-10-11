import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Calendar({
  items, // key = yyyy-mm-dd
  renderChip,
  initialMonth,
  onChipClick,
}: {
  items: { date: string; key: string; node: ReactNode }[]
  renderChip?: boolean
  initialMonth?: Date
  onChipClick?: (key: string) => void
}) {
  const [cur, setCur] = useState(initialMonth ?? new Date())
  const byDay = useMemo(() => {
    const m = new Map<string, { key: string; node: ReactNode }[]>()
    for (const it of items) {
      const arr = m.get(it.date) ?? []
      arr.push(it)
      m.set(it.date, arr)
    }
    return m
  }, [items])

  const cells = useMemo(() => {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7 // Thứ 2 là cột đầu
    const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    const out: (Date | null)[] = Array.from({ length: offset }, () => null)
    for (let d = 1; d <= days; d++) out.push(new Date(cur.getFullYear(), cur.getMonth(), d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [cur])

  const today = ymd(new Date())

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-ink px-4 py-2.5 text-paper">
        <button
          className="rounded p-1 hover:bg-zinc-800"
          onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}
          aria-label="Tháng trước"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="font-display text-lg font-bold uppercase tracking-wide">
          Tháng {cur.getMonth() + 1}/{cur.getFullYear()}
        </h3>
        <button
          className="rounded p-1 hover:bg-zinc-800"
          onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}
          aria-label="Tháng sau"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        {DOW.map((d) => (
          <div key={d} className="px-1 py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-24 border-b border-r border-zinc-100 bg-zinc-50/60" />
          const ds = ymd(d)
          const dayItems = byDay.get(ds) ?? []
          const isToday = ds === today
          return (
            <div
              key={i}
              className={`min-h-24 border-b border-r border-zinc-100 p-1 ${i % 7 >= 5 ? 'bg-orange-50/40' : ''}`}
            >
              <div
                className={`mx-auto mb-1 w-fit rounded px-1.5 text-[11px] font-bold ${
                  isToday ? 'bg-accent text-white' : 'text-zinc-400'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayItems.map((it) => (
                  <button
                    key={it.key}
                    className="w-full text-left"
                    onClick={() => onChipClick?.(it.key)}
                    title="Xem chi tiết"
                  >
                    {it.node}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
