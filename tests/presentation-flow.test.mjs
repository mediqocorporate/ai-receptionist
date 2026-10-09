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
  assert.match(html, /Smart MBS Billing analyses the consultation/)
  assert.match(html, /data-nav="\/products\/mbs-billing-suggestions"/)
})

test('home Medicare suggestion opens the prepared MBS item-number demo', () => {
  const html = renderAskHome()
  assert.match(html, /What MBS item number should we use for a standard GP consultation\?/)
})

test('accreditation view is a source-backed RACGP 5th Edition workspace', () => {
  const html = renderAccreditationPage({
    overview: {
      cycle: { id: 'c1', targetAssessmentDate: null },
      standardVersion: { name: 'RACGP Standards for general practices', edition: '5th edition' },
      coverage: { answered: 0, total: 20, percent: 0 },
      statusCounts: { APPEARS_READY: 0, NEEDS_ATTENTION: 0, CONFIRMED_GAP: 0, NOT_CHECKED: 124 },
      assessedCount: 0,
      nextAction: 'Start the Quick Readiness Check.',
    },
  }, { practiceName: 'Riverside Medical Centre', signedIn: true })
  assert.match(html, /Accreditation readiness/)
  assert.match(html, /Riverside Medical Centre/)
  assert.match(html, /RACGP 5TH EDITION/i)
  assert.match(html, /Assessment coverage/i)
  assert.match(html, /Quick Check/i)
  assert.match(html, /Not Checked/i)
  assert.doesNotMatch(html, /% ready|certified|compliant|pass\/fail/i)
})

test('accreditation view asks for facts instead of practice-manager self-assessment', () => {
  const html = renderAccreditationPage({
    view: 'check',
    overview: {
      cycle: { id: 'c1' },
      coverage: { answered: 0, total: 20, percent: 0 },
      nextQuestion: {
        id: 'Q1',
        wording: 'Is the process currently in place?',
        answerOptions: ['Yes', 'No', "I'm not sure"],
        priority: 'P1',
      },
    },
  }, { signedIn: true })
  assert.match(html, /Is the process currently in place\?/)
  assert.match(html, /I'm not sure/)
  assert.match(html, /facts, not a self-assessment/i)
  assert.match(html, /stays Not Checked/i)
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
