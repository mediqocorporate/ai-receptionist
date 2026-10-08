import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { assessRequirement } from '../netlify/functions/_shared/accreditation-assessment.mjs'
import { createAccreditationHandler } from '../netlify/functions/accreditation.mjs'

const dataset = JSON.parse(fs.readFileSync(new URL('../data/accreditation/generated/accreditation-dataset.json', import.meta.url), 'utf8'))
const foundationSql = fs.readFileSync(new URL('../supabase/migrations/202610090002_accreditation_foundation.sql', import.meta.url), 'utf8')
const componentFiles = [
  '../src/components/accreditation.js',
  '../src/components/accreditation/overview.js',
  '../src/components/accreditation/readiness-check.js',
  '../src/components/accreditation/requirements.js',
  '../src/components/accreditation/requirement-detail.js',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n')

test('HOLD requirement remains inactive and cannot enter the active readiness workspace', () => {
  const hold = dataset.requirements.find((item) => item.id === 'RACGP5-QI2-1C')
  assert.ok(hold)
  assert.equal(hold.contentValidationStatus, 'HOLD')
  assert.equal(hold.active, false)
})

test('VALIDATE requirements remain explicitly unverified rather than guessed mandatory or aspirational', () => {
  const unverified = dataset.requirements.filter((item) => item.classification === 'UNVERIFIED')
  assert.equal(unverified.length, 64)
  assert.ok(unverified.every((item) => /VALIDATE/i.test(item.classificationSource)))
})

test('positive user report is not Appears Ready without reviewed verification', () => {
  const result = assessRequirement({
    requirement: {
      id: 'R1',
      classification: 'MANDATORY',
      contentValidationStatus: 'VALIDATION_REQUIRED',
      active: true,
      applicability: 'Universal',
      plainEnglishRequirement: 'Maintain the process.',
    },
    question: { wording: 'Is this in place?' },
    response: { answerLabel: 'Yes' },
  })
  assert.equal(result.verificationStatus, 'USER_REPORTED')
  assert.equal(result.readinessStatus, 'NEEDS_ATTENTION')
})

test("unknown answer remains Not Checked and is not converted into a failure", () => {
  const result = assessRequirement({
    requirement: {
      id: 'R1',
      classification: 'MANDATORY',
      contentValidationStatus: 'VALIDATION_REQUIRED',
      active: true,
      applicability: 'Universal',
      plainEnglishRequirement: 'Maintain the process.',
    },
    question: { wording: 'Is this in place?' },
    response: { answerLabel: "I'm not sure" },
  })
  assert.equal(result.readinessStatus, 'NOT_CHECKED')
  assert.equal(result.confirmedGaps.length, 0)
})

test('client-supplied tenant identifiers cannot override the authenticated practice', async () => {
  const calls = []
  const handler = createAccreditationHandler({
    authenticate: async () => ({ userId: 'user_a', practiceId: 'practice_a' }),
    createServer: () => ({
      getOrCreateAccreditationCycle: async (practiceId) => {
        calls.push(['cycle', practiceId])
        return { id: 'cycle_a', practice_id: practiceId }
      },
      getAccreditationOverview: async ({ practiceId, cycleId }) => {
        calls.push(['overview', practiceId, cycleId])
        return { cycle: { id: cycleId, practiceId } }
      },
    }),
  })
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer good' },
    body: JSON.stringify({ action: 'overview', practiceId: 'practice_b' }),
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(calls, [['cycle', 'practice_a'], ['overview', 'practice_a', 'cycle_a']])
})

test('current RACGP5 workspace is explicitly separate from future-readiness versions', () => {
  assert.match(foundationSql, /workspace_type text not null check \(workspace_type in \('CURRENT','FUTURE_READINESS'\)\)/)
  assert.match(foundationSql, /'RACGP5',[\s\S]*'5th edition',[\s\S]*'CURRENT',[\s\S]*true/)
})

test('accreditation UI avoids prohibited certification and pass-fail claims', () => {
  assert.doesNotMatch(componentFiles, /\bcertified\b|\bcompliant\b|\bpass\/fail\b|\bpassed\b|\bfailed accreditation\b/i)
})
