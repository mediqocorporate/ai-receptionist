import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as productPage from '../src/components/product-page.js'
import * as chat from '../src/components/chat.js'
import { renderSignupDialog } from '../src/components/dialogs.js'
import { demoQuestions } from '../src/data/demo-questions.js'
import { products } from '../src/data/products.js'
import { matchDemoQuestion } from '../src/lib/question-matcher.js'

test('calendar month controls change month while preserving a valid selected day', () => {
  const product = products[0]
  const html = productPage.renderProductPage(product, { year: 2026, month: 9, date: 16 })
  assert.match(html, /data-calendar-month="-1"/)
  assert.match(html, /data-calendar-month="1"/)
  const next = productPage.shiftCalendarSelection({ year: 2026, month: 9, date: 31, time: '09:45' }, 1)
  assert.deepEqual(next, { year: 2026, month: 10, date: 30, time: '' })
  const nextHtml = productPage.renderProductPage(product, next)
  assert.match(nextHtml, /November 2026/)
  assert.doesNotMatch(nextHtml, /data-calendar-date="31"/)
})

test('app wires the calendar month controls to the shared month-selection helper', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  assert.match(app, /data-calendar-month/)
  assert.match(app, /shiftCalendarSelection/)
  assert.match(app, /formatCalendarDate/)
})

test('broad RACGP evidence question has a whole-practice evidence answer', () => {
  const answer = matchDemoQuestion('What evidence do I need to prepare for RACGP accreditation?', demoQuestions)
  assert.equal(answer?.id, 'accreditation-evidence')
  assert.match(answer.intro, /whole practice/i)
  const titles = answer.sections.map((section) => section.title).join(' ')
  assert.match(titles, /Policies and procedures/)
  assert.match(titles, /Staff training/)
  assert.match(titles, /Credentials/)
  assert.match(titles, /Equipment/)
  assert.match(titles, /Privacy/)
})

test('Q&A timestamps use a supplied current time instead of a hard-coded demo time', () => {
  const now = new Date('2026-10-04T14:47:00')
  const stamp = chat.formatMessageTimestamp(now)
  assert.match(stamp, /^Today, /)
  assert.doesNotMatch(stamp, /10:24/)
  const html = chat.renderAnswerView(demoQuestions[0], 'Question', { now })
  assert.ok(html.includes(stamp))
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  const chatSource = fs.readFileSync(new URL('../src/components/chat.js', import.meta.url), 'utf8')
  assert.doesNotMatch(app + chatSource, /Today, 10:24 AM/)
})

test('signup copy does not promise an unimplemented email verification step', () => {
  const html = renderSignupDialog()
  assert.doesNotMatch(html, /verify your email in the next step/i)
  assert.match(html, /Use your work email for your MediQo account/)
})

test('compact composer hides its internal vertical scrollbar', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.chat-composer\.compact \.composer-main textarea[^}]*overflow-y:\s*hidden/s)
})

test('desktop accreditation checklist uses the available width instead of forcing horizontal scroll', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.accreditation-table\s*\{[^}]*min-width:\s*1040px/s)
  assert.match(css, /\.accreditation-page \.feature-split[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  assert.match(css, /\.accreditation-page \.accreditation-side[^}]*grid-template-columns/s)
})
