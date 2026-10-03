import test from 'node:test'
import assert from 'node:assert/strict'
import { products } from '../src/data/products.js'
import { demoQuestions } from '../src/data/demo-questions.js'
import { accreditationItems } from '../src/data/accreditation.js'
import { policyTemplates } from '../src/data/policies.js'
import { alerts } from '../src/data/alerts.js'

test('seven product definitions preserve Elley product copy', () => {
  assert.equal(products.length, 7)
  assert.equal(products[0].slug, 'ai-receptionist')
  assert.equal(products[0].headline, 'Answer every patient call, book every patient appointment')
  assert.equal(products.at(-1).slug, 'online-bookings')
  assert.equal(products.at(-1).headline, 'Offer online bookings directly from your website')
})

test('prototype has meaningful demo datasets', () => {
  assert.ok(demoQuestions.length >= 7)
  assert.ok(accreditationItems.length >= 8 && accreditationItems.length <= 12)
  assert.ok(policyTemplates.some((item) => item.title === 'New Receptionist Onboarding Checklist'))
  assert.deepEqual(alerts.map((item) => item.category), ['RACGP', 'Medicare', 'Modern Award'])
})
