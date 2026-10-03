import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSignup } from '../src/lib/validation.js'

test('signup validation rejects missing and malformed fields', () => {
  const errors = validateSignup({ clinicName: '', firstName: '', lastName: '', jobTitle: '', email: 'bad', password: '123', locations: [] })
  assert.equal(errors.clinicName, 'Clinic name is required')
  assert.equal(errors.email, 'Enter a valid work email')
  assert.equal(errors.password, 'Use at least 8 characters')
  assert.equal(errors.locations, 'Select at least one location')
})

test('signup validation accepts complete form', () => {
  assert.deepEqual(validateSignup({
    clinicName: 'Riverside Medical Centre', firstName: 'Sarah', lastName: 'Jones', jobTitle: 'Practice Manager', email: 'sarah@riverside.com.au', password: 'strongpass', locations: ['NSW']
  }), {})
})
