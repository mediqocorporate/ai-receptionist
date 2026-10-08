import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { APP_ROUTES } from '../src/data/routes.js'
import { renderPmsDialog, renderSignupDialog } from '../src/components/dialogs.js'

const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
const openaiSource = fs.readFileSync(new URL('../netlify/functions/_shared/openai.mjs', import.meta.url), 'utf8')

test('Elly launch scope hides the global Reports menu while question storage remains available elsewhere', () => {
  assert.equal(APP_ROUTES.some((route) => route.path === '/reports' || route.id === 'reports'), false)
})

test('signup keeps Elly approved copy and Riverside as grey suggestion only', () => {
  const html = renderSignupDialog()
  assert.match(html, /Don't lose your answers\. Keep using <span>MediQo<\/span> for free\./)
  assert.match(html, /Create a free account to save this conversation, keep asking questions and access tools built for Australian general practice\./)
  assert.match(html, /Save your questions and answers/)
  assert.match(html, /Get answers personalised to your practice/)
  assert.match(html, /Ask as many questions as you need/)
  assert.match(html, /Access practice templates and tools/)
  assert.match(html, /Stay across important changes/)
  assert.match(html, /placeholder="(?:e\.g\. )?Riverside Medical Centre"/)
  assert.doesNotMatch(html, /name="clinicName"[^>]+value="Riverside Medical Centre"/)
})

test('PMS step 1 shows exactly the four requested vendors with Connect actions', () => {
  const html = renderPmsDialog({ step: 1 })
  for (const vendor of ['Nookal', 'Best Practice', 'Cliniko', 'Halaxy']) {
    assert.match(html, new RegExp(vendor))
  }
  assert.doesNotMatch(html, /Other PMS/)
  assert.equal((html.match(/data-action="pms-select-vendor"/g) || []).length, 4)
})

test('PMS step 2 asks for Site ID and Pair key and uses Close and Continue', () => {
  const html = renderPmsDialog({ step: 2, vendor: 'Best Practice' })
  assert.match(html, /Site ID/)
  assert.match(html, /Pair key/)
  assert.match(html, /data-action="close-dialog"[^>]*>Close</)
  assert.match(html, /data-action="pms-continue"[^>]*>Continue</)
})

test('PMS step 3 uses Elly exact setup copy and real demo calendar embed', () => {
  const html = renderPmsDialog({ step: 3, vendor: 'Best Practice' })
  assert.match(html, /Complete your setup/)
  assert.match(html, /Select a date and time from the options below, and we'll complete your setup with you, enable any new features and show you how to get the most out of MediQo\./)
  assert.match(html, /class="meetings-iframe-container"/)
  assert.match(html, /meetings-ap1\.hubspot\.com\/matt-nott\/practice-manager-demo\?embed=true/)
})

test('conversation Back performs a real page navigation so the Ask home is freshly rendered', () => {
  assert.match(appSource, /back-to-ask-home[^\n]+location\.(?:assign|replace)\(['"]\/['"]\)/)
})

test('live AI commercial rules include Elly product recommendation and competitor handling requirements', () => {
  for (const phrase of [
    'Smart MBS Billing analyses the consultation',
    'AI Receptionist can answer patient calls',
    'generate structured clinical notes',
    'GP Chronic Condition Management Plans',
    'Embedded Telehealth',
    'Document Sorter',
    'Online Bookings',
    'CareGP',
    'Veronica',
    'Heidi',
    'Lyrebird',
    'MBS Pro',
    'Cubiko',
  ]) assert.match(openaiSource, new RegExp(phrase.replace(/[.*+?^$()|[\]\\]/g, '\\$&'), 'i'))

  assert.match(openaiSource, /answer (?:the )?user(?:'s)? actual question first/i)
  assert.match(openaiSource, /do not insult|do not disparage/i)
  assert.match(openaiSource, /do not invent competitor/i)
  assert.match(openaiSource, /do not recommend (?:a |named )?competitor/i)
})
