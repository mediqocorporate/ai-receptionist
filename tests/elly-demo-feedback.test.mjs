import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderShell } from '../src/components/shell.js'
import * as dialogs from '../src/components/dialogs.js'
import * as chat from '../src/components/chat.js'
import * as policies from '../src/components/policies.js'
import { renderProductPage } from '../src/components/product-page.js'
import { products } from '../src/data/products.js'
import { policyTemplates } from '../src/data/policies.js'
import { createDefaultState, loadPrototypeState, savePrototypeState } from '../src/lib/persistence.js'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

test('anonymous shell hides practice identity while signed-in shell shows it and request feature stays available', () => {
  const anonymous = renderShell({ user: null })
  assert.doesNotMatch(anonymous, /class="practice-selector"/)
  assert.doesNotMatch(anonymous, /class="sidebar-user"/)
  assert.doesNotMatch(anonymous, /class="top-avatar"/)
  assert.match(anonymous, /data-action="request-feature"/)

  const signedIn = renderShell({ user: { firstName: 'Sarah', lastName: 'Jones' }, selectedPractice: 'Riverside Medical Centre' })
  assert.match(signedIn, /class="practice-selector"/)
  assert.match(signedIn, /class="sidebar-user"/)
  assert.match(signedIn, /class="top-avatar"/)
})

test('account signup offers every Australian state and territory without Other', () => {
  const html = dialogs.renderSignupDialog({ values: { locations: ['NSW'] } })
  for (const location of ['NSW', 'VIC', 'QLD', 'ACT', 'WA', 'SA', 'NT', 'TAS']) {
    assert.match(html, new RegExp(`value="${location}"`))
  }
  assert.doesNotMatch(html, /value="Other"/)
  assert.match(html, /name="password"/)
})

test('request a free trial is a separate sales form and never asks for a password', () => {
  assert.equal(typeof dialogs.renderTrialRequestDialog, 'function')
  const html = dialogs.renderTrialRequestDialog?.() || ''
  assert.match(html, /Request a free trial/i)
  assert.match(html, /data-trial-request-form/)
  assert.doesNotMatch(html, /name="password"/)
  assert.doesNotMatch(html, /Create account/i)
  assert.match(renderProductPage(products[0]), /Request a free trial/)
})

test('request a feature has a dedicated demo form', () => {
  assert.equal(typeof dialogs.renderFeatureRequestDialog, 'function')
  const html = dialogs.renderFeatureRequestDialog?.() || ''
  assert.match(html, /Request a feature/i)
  assert.match(html, /data-feature-request-form/)
  assert.match(html, /Feature suggestion/i)
})

test('signed-in Ask page can show recent question history while anonymous home stays unchanged', () => {
  const anonymous = chat.renderAskHome()
  assert.doesNotMatch(anonymous, /Your recent questions/)

  const signedIn = chat.renderAskHome({
    signedIn: true,
    history: [
      { question: 'What evidence do I need to prepare for RACGP accreditation?', answerId: 'accreditation-evidence', askedAt: '2026-10-04T03:15:00.000Z' },
    ],
  })
  assert.match(signedIn, /Your recent questions/)
  assert.match(signedIn, /What evidence do I need to prepare for RACGP accreditation\?/)
  assert.match(signedIn, /data-history-question=/)
})

test('question history is part of persistent prototype state', () => {
  const storage = memoryStorage()
  const state = createDefaultState('mq_history')
  assert.deepEqual(state.questionHistory, [])
  state.questionHistory.push({ question: 'A question', answerId: 'answer-1', askedAt: '2026-10-04T00:00:00.000Z' })
  savePrototypeState(state, storage)
  assert.deepEqual(loadPrototypeState(storage, '').questionHistory, state.questionHistory)
})

test('Policy Library includes substantive sample checklists that can be previewed', () => {
  const checklists = policyTemplates.filter((item) => item.category === 'Checklists')
  assert.ok(checklists.length >= 5)
  assert.ok(checklists.every((item) => Array.isArray(item.sampleContent) && item.sampleContent.length >= 4))
  assert.equal(typeof policies.renderTemplatePreview, 'function')
  const html = policies.renderTemplatePreview?.(checklists[0]) || ''
  assert.match(html, /Sample checklist/i)
  assert.match(html, /checklist-preview-item/)
})

test('related resources with official URLs render as real external links', () => {
  const answer = {
    id: 'resource-test',
    intro: 'Intro',
    sections: [],
    sources: [],
    relatedQuestions: [],
    relatedResources: [
      { title: 'Standards for general practices', publisher: 'RACGP', url: 'https://www.racgp.org.au/example' },
    ],
  }
  const html = chat.renderAnswerView(answer, 'Question')
  assert.match(html, /href="https:\/\/www\.racgp\.org\.au\/example"/)
  assert.match(html, /target="_blank"/)
  assert.doesNotMatch(html, /resource-unavailable/)
})

test('index declares the MediQo favicon explicitly', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /rel="icon"[^>]+href="\/favicon\.svg"/)
})

test('app wires the approved demo flows without using trial signup as account creation', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  assert.match(source, /renderTrialRequestDialog/)
  assert.match(source, /renderFeatureRequestDialog/)
  assert.match(source, /ui\.dialog === 'trial-request'/)
  assert.match(source, /ui\.dialog === 'feature-request'/)
  assert.match(source, /prototype\.questionHistory/)
  assert.match(source, /user:\s*prototype\.user/)
  assert.match(source, /renderTemplatePreview/)
  assert.doesNotMatch(source, /openDialog\('signup', \{ trial: true/)
})
