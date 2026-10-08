const BASE = 'https://api.hubapi.com'

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.message || `HubSpot request failed with status ${response.status}.`)
  return body
}

export async function syncHubSpotContact({ token, contact, fetchImpl = fetch }) {
  if (!token) return { status: 'pending', reason: 'hubspot_not_configured' }
  if (!contact?.email) throw new Error('HubSpot contact email is required.')

  const search = await fetchImpl(`${BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: contact.email }] }],
      properties: ['email'],
      limit: 1,
    }),
  })
  const searchBody = await parseResponse(search)
  const existingId = searchBody?.results?.[0]?.id
  const properties = Object.fromEntries(Object.entries(contact).filter(([, value]) => value !== undefined && value !== null && value !== ''))

  if (existingId) {
    const update = await fetchImpl(`${BASE}/crm/v3/objects/contacts/${existingId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ properties }),
    })
    const updated = await parseResponse(update)
    return { status: 'synced', contactId: updated.id || existingId }
  }

  const create = await fetchImpl(`${BASE}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ properties }),
  })
  const created = await parseResponse(create)
  return { status: 'synced', contactId: created.id }
}
