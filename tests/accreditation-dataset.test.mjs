import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const importerUrl = new URL('../scripts/import-accreditation-dataset.mjs', import.meta.url)
const generatedUrl = new URL('../data/accreditation/generated/accreditation-dataset.json', import.meta.url)

async function loadImporter() {
  if (!fs.existsSync(importerUrl)) return null
  return import(importerUrl.href)
}

function loadGenerated() {
  if (!fs.existsSync(generatedUrl)) return null
  return JSON.parse(fs.readFileSync(generatedUrl, 'utf8'))
}

test('accreditation importer and generated asset exist', () => {
  assert.equal(fs.existsSync(importerUrl), true)
  assert.equal(fs.existsSync(generatedUrl), true)
})

test('generated accreditation dataset preserves workbook source counts', () => {
  const data = loadGenerated()
  assert.ok(data)
  assert.deepEqual(data.meta.requiredSheets, [
    'README',
    'Requirements',
    'Questions',
    'Answer Options',
    'Branching Logic',
    'Evidence Criteria',
    'Sources',
  ])
  assert.equal(data.requirements.length, 125)

  const classifications = data.requirements.reduce((counts, item) => {
    counts[item.classification] = (counts[item.classification] || 0) + 1
    return counts
  }, {})
  assert.deepEqual(classifications, { MANDATORY: 55, UNVERIFIED: 64, ASPIRATIONAL: 6 })

  const priorities = data.requirements.reduce((counts, item) => {
    counts[item.quickCheckPriority] = (counts[item.quickCheckPriority] || 0) + 1
    return counts
  }, {})
  assert.deepEqual(priorities, { P1: 20, P2: 30, P3: 75 })
  assert.equal(data.requirements.filter((item) => item.criticalSafetyArea).length, 20)
})

test('HOLD requirement is retained for traceability but inactive', () => {
  const data = loadGenerated()
  const hold = data?.requirements.find((item) => item.id === 'RACGP5-QI2-1C')
  assert.ok(hold)
  assert.equal(hold.contentValidationStatus, 'HOLD')
  assert.equal(hold.active, false)
  assert.equal(hold.classification, 'UNVERIFIED')
})

test('dataset importer rejects duplicate IDs, broken references and unsupported classifications', async () => {
  const importer = await loadImporter()
  assert.ok(importer)

  const base = {
    requirements: [{ id: 'R1', classification: 'MANDATORY', active: true }],
    questions: [{ id: 'Q1', requirementId: 'R1' }],
    answerOptions: [{ questionId: 'Q1', order: 1, label: 'Yes' }],
    branchingRules: [],
    evidenceCriteria: [],
    sources: [],
  }

  assert.throws(
    () => importer.validateAccreditationDataset({
      ...base,
      requirements: [...base.requirements, { ...base.requirements[0] }],
    }),
    /duplicate requirement id/i,
  )

  assert.throws(
    () => importer.validateAccreditationDataset({
      ...base,
      questions: [{ id: 'Q1', requirementId: 'MISSING' }],
    }),
    /unknown requirement/i,
  )

  assert.throws(
    () => importer.validateAccreditationDataset({
      ...base,
      requirements: [{ id: 'R1', classification: 'GUESS', active: true }],
    }),
    /unsupported classification/i,
  )
})
