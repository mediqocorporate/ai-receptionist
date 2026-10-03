import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestion, matchDemoQuestion } from '../src/lib/question-matcher.js'
import { demoQuestions } from '../src/data/demo-questions.js'

test('normalizes punctuation, casing and repeated whitespace', () => {
  assert.equal(normalizeQuestion('  CPR, Accreditation?!  '), 'cpr accreditation')
})

test('matches accreditation certificates paraphrases', () => {
  assert.equal(matchDemoQuestion('For accreditation, what certificates do I need from our doctors?', demoQuestions)?.id, 'accreditation-certificates')
  assert.equal(matchDemoQuestion('WHAT GP CERTIFICATES should I keep for RACGP accreditation???', demoQuestions)?.id, 'accreditation-certificates')
})

test('matches receptionist attendance scenario', () => {
  assert.equal(matchDemoQuestion('My new receptionist is in her third week and has missed shifts. What can I do?', demoQuestions)?.id, 'new-receptionist-attendance')
})

test('returns null for unsupported questions', () => {
  assert.equal(matchDemoQuestion('What is the weather tomorrow?', demoQuestions), null)
})


test('matches prepared home suggestion topics for complaints and community DNA fees', () => {
  assert.equal(matchDemoQuestion('A patient has made a complaint. What should I do next?', demoQuestions)?.id, 'patient-complaint')
  assert.equal(matchDemoQuestion('How are other practices handling DNA fees?', demoQuestions)?.id, 'dna-fee-community')
})

test('related questions stay interactive by resolving to their parent answer', () => {
  assert.equal(matchDemoQuestion('How often does CPR need to be renewed?', demoQuestions)?.id, 'accreditation-certificates')
})
