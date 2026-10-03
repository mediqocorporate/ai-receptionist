export function validateSignup(values = {}) {
  const errors = {}
  if (!String(values.clinicName || '').trim()) errors.clinicName = 'Clinic name is required'
  if (!String(values.firstName || '').trim()) errors.firstName = 'First name is required'
  if (!String(values.lastName || '').trim()) errors.lastName = 'Last name is required'
  if (!String(values.jobTitle || '').trim()) errors.jobTitle = 'Job title is required'
  const email = String(values.email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid work email'
  if (String(values.password || '').length < 8) errors.password = 'Use at least 8 characters'
  if (!Array.isArray(values.locations) || values.locations.length === 0) errors.locations = 'Select at least one location'
  return errors
}
