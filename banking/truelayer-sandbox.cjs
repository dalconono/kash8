// Server-side sandbox client. The caller must bind connection IDs to browser sessions.
const api = 'https://api.truelayer-sandbox.com/v3'
function sandboxClient({ clientId, clientSecret, callbackUrl, fetchImpl = fetch }) {
  const callback = new URL(callbackUrl)
  if (callback.protocol !== 'https:' || callback.username || callback.password) {
    throw new Error('Configure a valid HTTPS callback')
  }
  if (!clientId || !clientSecret) throw new Error('Configure sandbox credentials')

  async function request(url, options) {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`TrueLayer sandbox returned HTTP ${response.status}`)
    return response.json()
  }

  async function accessToken() {
    const token = await request('https://auth.truelayer-sandbox.com/connect/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'data',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Missing sandbox access token')
    return token.access_token
  }

  async function start({ name, email }) {
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.includes('@')) {
      throw new Error('A sandbox tester name and email are required')
    }
    const token = await accessToken()

    return request(api + '/data-connections', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  async function readBalance(connectionId) {
    const headers = { Authorization: `Bearer ${await accessToken()}`, 'Connection-Id': connectionId }
    // Data endpoints enforce authorisation for the server-owned connection.
    const { items, pagination } = await request(api + '/connected-accounts?type=account', { headers })
    if (!Array.isArray(items) || items.length >= 50 || pagination?.next_cursor) return null
    const accounts = items.filter((account) => account.type === 'account' &&
      account.account_type === 'current' && account.currency === 'GBP')
    if (accounts.length !== 1 || !/^[\w-]{1,128}$/.test(accounts[0].id ?? '')) return null
    const balance = await request(api + `/connected-accounts/${accounts[0].id}/balance`, { headers })
    const { current_balance_in_minor: current, available_balance_in_minor: available,
      overdraft_in_minor: overdraft } = balance
    if (balance.currency !== 'GBP' || ![current, available, overdraft].every(Number.isSafeInteger) || overdraft < 0) {
      return null
    }
    const cash = Math.min(current, available - overdraft)
    return Number.isSafeInteger(cash) ? cash : null
  }

  return { start, readBalance }
}

module.exports = { sandboxClient }
