import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAskHome, renderAnswerView } from '../src/components/chat.js'
import { renderAccreditationPage } from '../src/components/accreditation.js'
import { renderProductPage } from '../src/components/product-page.js'
import { demoQuestions } from '../src/data/demo-questions.js'
import { products } from '../src/data/products.js'
import { matchDemoQuestion } from '../src/lib/question-matcher.js'
import { canAskWithoutSignup, recordAnsweredQuestion } from '../src/lib/prototype-rules.js'

test('prepared Q&A includes an MBS item-number demo with MediQo cross-sell', () => {
  const prompt = 'What MBS item number should we use for a standard GP consultation?'
  const answer = matchDemoQuestion(prompt, demoQuestions)
  assert.equal(answer?.id, 'mbs-item-number')
  const html = renderAnswerView(answer, prompt)
  assert.match(html, /MBS Item 23/)
  assert.match(html, /See how MediQo can suggest MBS items/)
  assert.match(html, /data-nav="\/products\/mbs-billing-suggestions"/)
})

test('home Medicare suggestion opens the prepared MBS item-number demo', () => {
  const html = renderAskHome()
  assert.match(html, /What MBS item number should we use for a standard GP consultation\?/)
})

test('phase-one accreditation view is a guided personalised plan', () => {
  const html = renderAccreditationPage({}, { practiceName: 'Riverside Medical Centre', targetDate: 'March 2027' })
  assert.match(html, /Your accreditation plan/)
  assert.match(html, /Riverside Medical Centre/)
  assert.match(html, /March 2027/)
  assert.match(html, /practical requirements/i)
  assert.match(html, /Evidence required/)
  assert.match(html, /Outstanding actions/)
  assert.match(html, /Phase 2 preview/)
})

test('accreditation view explains the manual workflow MediQo is replacing', () => {
  const html = renderAccreditationPage()
  assert.match(html, /From manual preparation to a guided plan/)
  assert.match(html, /spreadsheets, folders/i)
  assert.match(html, /guided plan/i)
})

test('every product page keeps the lead-capture headline, CTAs and calendar', () => {
  for (const product of products) {
    const html = renderProductPage(product)
    assert.ok(html.includes(product.headline))
    assert.match(html, /Book a demo/)
    assert.match(html, /Request a free trial/)
    assert.match(html, /Find a time to meet with MediQo/)
  }
})

test('anonymous user gets two answered questions before account creation is required', () => {
  const state = { user: null, freeQuestionCount: 0 }
  assert.equal(canAskWithoutSignup(state), true)
  recordAnsweredQuestion(state)
  assert.equal(canAskWithoutSignup(state), true)
  recordAnsweredQuestion(state)
  assert.equal(canAskWithoutSignup(state), false)
})
