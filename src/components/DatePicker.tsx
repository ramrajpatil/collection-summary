import { useState } from 'react'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  formatDigits,
  formatMonth,
  shiftIsoDate,
  todayIso,
} from '../lib/marathi'
import { BottomSheet } from './BottomSheet'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

interface DatePickerProps {
  value: string
  max: string
  onSelect: (isoDate: string) => void
  onClose: () => void
}

const MR_WEEKDAYS = ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि']
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function DatePicker({
  value,
  max,
  onSelect,
  onClose,
}: DatePickerProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]
  const today = todayIso()

  const [month, setMonth] = useState(monthOf(value))
  const [year, monthNo] = month.split('-').map(Number)

  const daysInMonth = new Date(year, monthNo, 0).getDate()
  const startWeekday = new Date(year, monthNo - 1, 1).getDay()

  const firstOfMonth = `${month}-01`
  const prevMonth = monthOf(shiftIsoDate(firstOfMonth, -1))
  const nextMonth = monthOf(shiftIsoDate(firstOfMonth, 32))
  const canGoNext = `${nextMonth}-01` <= max

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)

  const weekdays = lang === 'mr' ? MR_WEEKDAYS : EN_WEEKDAYS

  function pick(day: number) {
    const isoDate = `${month}-${pad2(day)}`
    if (isoDate > max) return
    onSelect(isoDate)
    onClose()
  }

  return (
    <BottomSheet
      title={s.selectDate}
      closeLabel={s.close}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-ghost wide"
          onClick={() => {
            onSelect(today)
            onClose()
          }}
        >
          {s.goToday}
        </button>
      }
    >
      <div className="calendar">
        <div className="calendar-head">
          <button
            type="button"
            className="icon-btn"
            aria-label={s.prevMonth}
            onClick={() => setMonth(prevMonth)}
          >
            <ChevronLeftIcon />
          </button>
          <b className="calendar-title">{formatMonth(month, lang)}</b>
          <button
            type="button"
            className="icon-btn"
            aria-label={s.nextMonth}
            disabled={!canGoNext}
            onClick={() => setMonth(nextMonth)}
          >
            <ChevronRightIcon />
          </button>
        </div>

        <div className="calendar-grid">
          {weekdays.map((weekday) => (
            <span className="calendar-weekday" key={weekday}>
              {weekday}
            </span>
          ))}

          {cells.map((day, index) => {
            if (day === null) {
              return (
                <span
                  className="calendar-day empty"
                  key={`empty-${index}`}
                  aria-hidden
                />
              )
            }
            const isoDate = `${month}-${pad2(day)}`
            const disabled = isoDate > max
            const selected = isoDate === value
            const isToday = isoDate === today
            return (
              <button
                key={isoDate}
                type="button"
                className={`calendar-day${selected ? ' selected' : ''}${
                  isToday ? ' today' : ''
                }`}
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => pick(day)}
              >
                {formatDigits(day, lang)}
              </button>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}