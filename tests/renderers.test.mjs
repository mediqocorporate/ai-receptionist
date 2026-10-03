import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAskHome, renderAnswerView } from '../src/components/chat.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { renderPolicyPage } from '../src/components/policies.js'
import { renderReportsPage } from '../src/components/reports.js'
import { renderAlertsPage } from '../src/components/alerts.js'
import { renderProductPage } from '../src/components/product-page.js'
import { demoQuestions } from '../src/data/demo-questions.js'
import { products } from '../src/data/products.js'

test('Ask a Question home renders six suggestion cards and composer', () => {
  const html = renderAskHome()
  assert.match(html, /Your AI Assistant for Practice Management/)
  assert.equal((html.match(/data-suggestion=/g) || []).length, 6)
  assert.match(html, /Ask MediQo anything about running your practice/)
})

test('seeded answer renders presentation-ready sources and related content', () => {
  const html = renderAnswerView(demoQuestions[0], demoQuestions[0].prompts[0])
  assert.doesNotMatch(html, /Sample answer|Illustrative content/i)
  assert.match(html, /Sources/)
  assert.match(html, /Related questions/)
  assert.match(html, /Related resources/)
})

test('feature pages render required headings', () => {
  assert.match(renderAccreditationPage(), /Accreditation readiness/)
  assert.match(renderPolicyPage(), /Policy Library/)
  assert.match(renderReportsPage(), /Practice reports/)
  assert.match(renderAlertsPage(), /Alerts Centre/)
})

test('product page uses supplied product copy and calendar actions', () => {
  const html = renderProductPage(products[0])
  assert.match(html, /Answer every patient call, book every patient appointment/)
  assert.match(html, /Book a demo/)
  assert.match(html, /Start a free trial/)
  assert.match(html, /Find a time to meet with MediQo/)
})


test('interactive chat controls expose working actions', () => {
  const home = renderAskHome()
  assert.match(home, /data-action="attach-file"/)
  const answer = renderAnswerView(demoQuestions[0], demoQuestions[0].prompts[0])
  assert.match(answer, /data-action="answer-helpful"/)
  assert.match(answer, /data-action="answer-not-helpful"/)
  assert.match(answer, /data-action="resource-unavailable"/)
})
