import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderSignupDialog, renderTrialRequestDialog } from '../src/components/dialogs.js'
import { renderProductPage } from '../src/components/product-page.js'
import { renderAnswerView } from '../src/components/chat.js'
import { renderReportsPage } from '../src/components/reports.js'
import { products } from '../src/data/products.js'
import { demoQuestions } from '../src/data/demo-questions.js'
import { resolveResourceUrl } from '../src/data/resource-links.js'
import { createDefaultState } from '../src/lib/persistence.js'
import { matchDemoQuestion } from '../src/lib/question-matcher.js'

test('signup gate uses Elly approved retention and benefit copy', () => {
  const html = renderSignupDialog()
  assert.match(html, /Don't lose your answers\. Keep using MediQo for free\./)
  assert.match(html, /Create a free account to save this conversation, keep asking questions and access tools built for Australian general practice\./)
  for (const copy of [
    'Save your questions and answers',
    'Get answers personalised to your practice',
    'Ask as many questions as you need',
    'Access practice templates and tools',
    'Stay across important changes',
  ]) assert.match(html, new RegExp(copy))
})

test('free trial uses the real HubSpot form embed', () => {
  const html = renderTrialRequestDialog()
  assert.match(html, /class="hs-form-frame"/)
  assert.match(html, /data-region="ap1"/)
  assert.match(html, /data-form-id="07bbbe65-ab6e-4ecb-b433-87975a9a36c8"/)
  assert.match(html, /data-portal-id="442479260"/)
  assert.doesNotMatch(html, /data-trial-request-form/)
})

test('product page uses the real HubSpot meetings embed rather than the styled calendar', () => {
  const html = renderProductPage(products[0])
  assert.match(html, /class="meetings-iframe-container"/)
  assert.match(html, /https:\/\/meetings-ap1\.hubspot\.com\/matt-nott\/practice-manager-demo\?embed=true/)
  assert.doesNotMatch(html, /data-calendar-date|calendar-days/)
})

test('MBS answer has a full Smart MBS Billing recommendation callout', () => {
  const answer = matchDemoQuestion('What MBS item number should we use for a standard GP consultation?', demoQuestions)
  const html = renderAnswerView(answer, answer.prompts[0])
  assert.match(html, /Smart MBS Billing analyses the consultation/)
  assert.match(html, /reducing manual searching/)
  assert.match(html, /product-recommendation/)
  assert.match(html, /\/products\/mbs-billing-suggestions/)
})

test('product discovery questions answer first and then recommend the relevant MediQo product', () => {
  const scribe = matchDemoQuestion('What is the best AI scribe for GPs?', demoQuestions)
  assert.equal(scribe?.id, 'ai-scribe-discovery')
  assert.match(scribe.intro, /assess|look for|compare/i)
  assert.equal(scribe.recommendation?.path, '/products/scribe')

  const receptionist = matchDemoQuestion('Can AI answer calls for a medical practice?', demoQuestions)
  assert.equal(receptionist?.id, 'ai-receptionist-discovery')
  assert.equal(receptionist.recommendation?.path, '/products/ai-receptionist')

  const broad = matchDemoQuestion('How can we use AI in our medical practice?', demoQuestions)
  assert.equal(broad?.id, 'ai-practice-discovery')
  assert.match(broad.sections.map((item) => item.body || '').join(' '), /MediQo brings many of these capabilities together/i)
})

test('official source links resolve to specific guidance pages', () => {
  assert.match(resolveResourceUrl({ title: 'Medicare claiming and billing guidance', publisher: 'Services Australia' }), /mbs-and-dva-billing/)
  assert.match(resolveResourceUrl({ title: 'Unfair dismissal', publisher: 'Fair Work Ombudsman' }), /ending-employment\/unfair-dismissal/)
  assert.match(resolveResourceUrl({ title: 'Data breach response guidance', publisher: 'OAIC' }), /data-breach-preparation-and-response/)
  assert.match(resolveResourceUrl({ title: 'Australian Charter of Healthcare Rights', publisher: 'Australian Commission on Safety and Quality in Health Care' }), /understanding-your-healthcare-rights/)
})

test('logged-in question storage has a dedicated persistent log and Reports table', () => {
  assert.deepEqual(createDefaultState('mq_logged').questionLog, [])
  const html = renderReportsPage({
    questionLog: [{
      question: 'How can we stop missing MBS items?',
      userName: 'Sarah Jones',
      email: 'sarah@riversideclinic.com.au',
      practiceName: 'Riverside Medical Centre',
      askedAt: '2026-10-07T00:00:00.000Z',
    }],
  })
  assert.match(html, /Question activity/)
  assert.match(html, /Sarah Jones/)
  assert.match(html, /sarah@riversideclinic\.com\.au/)
  assert.match(html, /Riverside Medical Centre/)
  assert.match(html, /How can we stop missing MBS items\?/)
})

test('app stores answered questions for signed-in users and activates HubSpot embeds', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  assert.match(source, /prototype\.questionLog/)
  assert.match(source, /if \(prototype\.user\)/)
  assert.match(source, /js-ap1\.hsforms\.net\/forms\/embed\/442479260\.js/)
  assert.match(source, /MeetingsEmbedCode\.js/)
})

test('index uses the supplied PNG favicon', () => {
  const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(source, /rel="icon"[^>]+href="\/favicon\.png"[^>]+image\/png/)
})
