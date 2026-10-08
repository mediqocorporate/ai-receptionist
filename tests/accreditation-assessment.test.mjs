import test from 'node:test'
import assert from 'node:assert/strict'
import { assessRequirement } from '../netlify/functions/_shared/accreditation-assessment.mjs'

const mandatory = {
  id: 'R1',
  classification: 'MANDATORY',
  contentValidationStatus: 'VALIDATION_REQUIRED',
  active: true,
  applicability: 'Universal',
  plainEnglishRequirement: 'Maintain a current process.',
}
const question = {
  id: 'Q1',
  requirementId: 'R1',
  wording: 'Is the process in place?',
  answerOptions: ['Yes', 'Partly', 'No', "I'm not sure"],
}

test("unknown answer remains NOT_CHECKED rather than becoming a gap", () => {
  const result = assessRequirement({ requirement: mandatory, question, response: { answerLabel: "I'm not sure" } })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.match(result.statusReason, /more information required/i)
  assert.ok(result.unknownFacts.length > 0)
})

test('positive user report does not automatically become APPEARS_READY', () => {
  const result = assessRequirement({ requirement: mandatory, question, response: { answerLabel: 'Yes' } })
  assert.equal(result.readinessStatus, 'NEEDS_ATTENTION')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.notEqual(result.readinessStatus, 'APPEARS_READY')
  assert.match(result.statusReason, /evidence|verification/i)
})

test('explicit negative answer to verified applicable requirement becomes CONFIRMED_GAP', () => {
  const result = assessRequirement({ requirement: mandatory, question, response: { answerLabel: 'No' } })
  assert.equal(result.applicabilityStatus, 'APPLICABLE')
  assert.equal(result.readinessStatus, 'CONFIRMED_GAP')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.ok(result.confirmedGaps.length > 0)
})

test('partial answer becomes NEEDS_ATTENTION when option semantics are partial', () => {
  for (const answerLabel of ['Partly', 'Some people', 'Sometimes', 'With limitations', "We're doing this now"]) {
    const result = assessRequirement({ requirement: mandatory, question, response: { answerLabel } })
    assert.equal(result.readinessStatus, 'NEEDS_ATTENTION', answerLabel)
    assert.equal(result.verificationStatus, 'USER_REPORTED', answerLabel)
  }
})

test('HOLD requirement is not actively assessed', () => {
  const result = assessRequirement({
    requirement: { ...mandatory, id: 'HOLD1', contentValidationStatus: 'HOLD', active: false },
    question,
    response: { answerLabel: 'No' },
  })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.equal(result.verificationStatus, null)
  assert.match(result.statusReason, /hold|validation/i)
})

test('missing or ambiguous response returns NOT_CHECKED and asks for more information', () => {
  const result = assessRequirement({ requirement: mandatory, question, response: { answerLabel: 'Unexpected answer' } })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.match(result.statusReason, /more information required/i)
  assert.equal(result.requiresReassessment, true)
})

test('VALIDATE classification stays unverified and cannot be marked APPEARS_READY from user report', () => {
  const result = assessRequirement({
    requirement: { ...mandatory, classification: 'UNVERIFIED' },
    question,
    response: { answerLabel: 'Yes' },
  })
  assert.equal(result.readinessStatus, 'NEEDS_ATTENTION')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.match(result.statusReason, /validation|unverified/i)
})

test('not-applicable response keeps readiness separate from applicability', () => {
  const result = assessRequirement({
    requirement: { ...mandatory, applicability: 'Only if vaccines are stored' },
    question: { ...question, answerOptions: [...question.answerOptions, 'Not applicable – we do not store vaccines'] },
    response: { answerLabel: 'Not applicable – we do not store vaccines' },
  })
  assert.equal(result.applicabilityStatus, 'NOT_APPLICABLE')
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.equal(result.verificationStatus, 'USER_REPORTED')
})

test('manually verified positive state can appear ready without losing verification state', () => {
  const result = assessRequirement({
    requirement: mandatory,
    question,
    response: { answerLabel: 'Yes' },
    previousState: {
      verificationStatus: 'MANUALLY_VERIFIED',
      confirmedGaps: [],
      knownFacts: ['Evidence reviewed by an authorised practice user.'],
    },
  })
  assert.equal(result.readinessStatus, 'APPEARS_READY')
  assert.equal(result.verificationStatus, 'MANUALLY_VERIFIED')
})
