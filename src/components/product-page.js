import { icon } from './icons.js'
import { escapeHtml } from '../lib/html.js'

const REMOTE_LOGO = 'https://partners.mediqo.health/wp-content/uploads/2025/11/Group-2.png'
const times = ['09:00','09:15','09:30','09:45','10:00','10:15','10:30','10:45','11:00']
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function normalizeCalendarSelection(selection = {}) {
  const yearValue = Number(selection.year)
  const monthValue = Number(selection.month)
  const year = Number.isInteger(yearValue) ? yearValue : 2026
  const month = Number.isInteger(monthValue) ? monthValue : 9
  const maxDay = daysInMonth(year, month)
  const date = Math.min(Math.max(Number(selection.date) || 5, 1), maxDay)
  return { year, month, date, time: selection.time || '' }
}

export function shiftCalendarSelection(selection = {}, delta = 0) {
  const current = normalizeCalendarSelection(selection)
  const target = new Date(current.year, current.month + Number(delta || 0), 1)
  const year = target.getFullYear()
  const month = target.getMonth()
  return {
    year,
    month,
    date: Math.min(current.date, daysInMonth(year, month)),
    time: '',
  }
}

export function formatCalendarDate(selection = {}, { shortMonth = false } = {}) {
  const current = normalizeCalendarSelection(selection)
  const month = shortMonth ? monthNames[current.month].slice(0, 3) : monthNames[current.month]
  return `${current.date} ${month} ${current.year}`
}

export function renderProductPage(product, selection = {}) {
  if (!product) return `<section class="feature-page"><h1>Product not found</h1></section>`
  const current = normalizeCalendarSelection(selection)
  const monthLabel = monthNames[current.month]
  const firstDayOffset = (new Date(current.year, current.month, 1).getDay() + 6) % 7
  const dates = Array.from({ length: daysInMonth(current.year, current.month) }, (_, index) => index + 1)

  return `<section class="product-page"><div class="product-hero"><span class="product-badge">${escapeHtml(product.badge)}</span><h1>${escapeHtml(product.headline)}</h1><p>${escapeHtml(product.body)}</p><div class="hero-actions"><button type="button" class="outline-cta" data-action="scroll-calendar">Book a demo ${icon('external',17)}</button><button type="button" class="gradient-cta" data-action="start-trial">Request a free trial ${icon('chevron',18)}</button></div></div><section class="demo-calendar" id="demo-calendar"><div class="calendar-left"><div class="calendar-logo-mark"><img class="calendar-mediqo-logo" src="${REMOTE_LOGO}" data-logo-fallback="/assets/mediqo-logo.png" alt="MediQo" /><span class="calendar-logo-fallback" aria-hidden="true">MediQo</span></div><h2>Find a time to meet with MediQo</h2><div class="calendar-month"><button type="button" class="calendar-month-button" data-calendar-month="-1" aria-label="Previous month">‹</button><strong>${monthLabel} ${current.year}</strong><button type="button" class="calendar-month-button" data-calendar-month="1" aria-label="Next month">›</button></div><div class="weekdays"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div><div class="calendar-days">${Array.from({ length: firstDayOffset }, () => '<span class="empty"></span>').join('')}${dates.map((date)=>`<button type="button" class="day ${current.date===date?'selected':''}" data-calendar-date="${date}">${date}</button>`).join('')}</div></div><div class="calendar-right"><div class="meeting-meta"><strong>Meeting location</strong><span>◉ Microsoft Teams</span></div><div class="meeting-meta"><strong>Meeting duration</strong><div class="duration-bar">30 mins</div></div><div class="time-heading"><strong>What time works best?</strong><span>Showing times for ${formatCalendarDate(current)}</span><small>Australian Eastern Time</small></div><div class="time-list">${times.map((time)=>`<button type="button" class="time ${current.time===time?'selected':''}" data-calendar-time="${time}">${time}</button>`).join('')}</div>${current.time?`<div class="slot-confirm"><strong>${icon('check',16)} Selected</strong><span>${formatCalendarDate(current)} · ${current.time}</span><button class="primary-button" type="button" data-action="confirm-demo">Confirm demo time</button></div>`:''}</div></section></section>`
}
