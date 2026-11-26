// Server-side sandbox client. Browser sessions must own the connection ID.
function sandboxClient({ clientId, clientSecret, callbackUrl, fetchImpl = fetch }) {
  const callback = new URL(callbackUrl)
  if (callback.protocol !== 'https:' || callback.username || callback.password) {
    throw new Error('Configure a valid HTTPS callback')
  }
  if (!clientId || !clientSecret) throw new Error('Configure sandbox credentials')

  async function request(url, options) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`TrueLayer sandbox returned HTTP ${response.status}`)
    return response.json()
  }

  async function start({ name, email }) {
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.includes('@')) {
      throw new Error('A sandbox tester name and email are required')
    }
    const token = await request('https://auth.truelayer-sandbox.com/connect/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'data',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!token.access_token) throw new Error('Missing sandbox access token')

    return request('https://api.truelayer-sandbox.com/v3/data-connections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopes: ['accounts', 'balance'],
        provider_selection: { type: 'user_selected', filter: { countries: ['GB'] } },
        user: { name: name.trim(), email: email.trim() },
        user_consent: { type: 'authorization_flow_captured' },
        hosted_page: { type: 'authorization_flow', return_uri: callback.href, country_code: 'GB' },
        data_access_type: 'one_time',
      }),
    })
  }

  return { start }
}

module.exports = { sandboxClient }
