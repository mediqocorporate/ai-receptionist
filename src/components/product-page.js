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

export function renderProductPage(product) {
  if (!product) return `<section class="feature-page"><h1>Product not found</h1></section>`

  return `<section class="product-page"><div class="product-hero"><span class="product-badge">${escapeHtml(product.badge)}</span><h1>${escapeHtml(product.headline)}</h1><p>${escapeHtml(product.body)}</p><div class="hero-actions"><button type="button" class="outline-cta" data-action="scroll-calendar">Book a demo ${icon('external',17)}</button><button type="button" class="gradient-cta" data-action="start-trial">Request a free trial ${icon('chevron',18)}</button></div></div><section class="demo-calendar hubspot-calendar" id="demo-calendar"><div class="hubspot-meeting-shell"><div class="calendar-logo-mark"><img class="calendar-mediqo-logo" src="${REMOTE_LOGO}" data-logo-fallback="/assets/mediqo-logo.png" alt="MediQo" /><span class="calendar-logo-fallback" aria-hidden="true">MediQo</span></div><span class="eyebrow">BOOK A DEMO</span><h2>Find a time to meet with MediQo</h2><p>Select a suitable time below and HubSpot will handle the booking confirmation.</p><div class="meetings-iframe-container" data-src="https://meetings-ap1.hubspot.com/matt-nott/practice-manager-demo?embed=true"></div></div></section></section>`
}
