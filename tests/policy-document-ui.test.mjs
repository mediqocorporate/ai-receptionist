import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderDocumentWizard, renderPolicyPage } from '../src/components/policies.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')

test('Create document asks what document is needed and what MediQo should consider', () => {
  const html = renderDocumentWizard(null, {}, false)
  assert.match(html, /What document do you need\?/i)
  assert.match(html, /name="documentType"/)
  assert.match(html, /What should MediQo consider/i)
  assert.match(html, /name="considerations"/)
  assert.match(html, /Generate draft/i)
})

test('generated document remains editable and can be saved or downloaded', () => {
  const html = renderDocumentWizard(null, {
    documentType: 'Reception onboarding procedure',
    considerations: 'Include privacy and escalation',
  }, true, {
    title: 'Reception Onboarding Procedure',
    content: 'Purpose\nA comprehensive draft body.',
  })
  assert.match(html, /data-draft-editor/)
  assert.match(html, /Purpose/)
  assert.match(html, /data-action="save-draft"/)
  assert.match(html, /data-action="download-document"/)
})

test('Policy Library can render saved practice documents', () => {
  const html = renderPolicyPage({
    savedDocuments: [{ id: 'doc_1', title: 'Privacy Procedure', document_type: 'Procedure', updated_at: '2026-10-09T00:00:00Z' }],
  })
  assert.match(html, /Your documents/i)
  assert.match(html, /Privacy Procedure/)
  assert.match(html, /data-policy-document-id="doc_1"/)
})

test('app routes document generation, saving and listing through the live policy document service', () => {
  assert.match(appSource, /policyDocumentService\.generate\(/)
  assert.match(appSource, /policyDocumentService\.save\(/)
  assert.match(appSource, /policyDocumentService\.list\(/)
  assert.match(appSource, /download-document/)
})
