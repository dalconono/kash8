import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createPilot } from './pilot.mjs'
import trueLayer from './truelayer-sandbox.cjs'

const origin = 'https://pilot.example.com'
const accessCode = 'a'.repeat(48)
const tester = { name: 'Test User', email: 'tester@example.com' }

test('one-time flow binds bank access to the initiating browser and consumes it once', async (t) => {
  const calls = []
  let now = 0
  let authorized = true
  let balance = {
    currency: 'GBP', current_balance_in_minor: 125050,
    available_balance_in_minor: 172550, overdraft_in_minor: 50000,
  }
  const client = trueLayer.sandboxClient({
    clientId: 'sandbox-test', clientSecret: 'test', callbackUrl: origin + '/bank/return',
    async fetchImpl(url, options) {
      calls.push(url)
      assert.equal(options.redirect, 'error')
      if (url.endsWith('/connect/token')) return Response.json({ access_token: 'test-token' })
      if (url.endsWith('/data-connections')) {
        const body = JSON.parse(options.body)
        assert.deepEqual(body.scopes, ['accounts', 'balance'])
        assert.equal(body.data_access_type, 'one_time')
        assert.equal(body.hosted_page.return_uri, origin + '/bank/return')
        return Response.json({
          id: 'owned-connection', status: 'authorization_required',
          hosted_page: { uri: 'https://app.truelayer-sandbox.com/data/test' },
        })
      }
      assert.equal(options.headers['Connection-Id'], 'owned-connection')
      if (url.endsWith('type=account')) {
        if (!authorized) return new Response(null, { status: 403 })
        return Response.json({ items: [{ id: 'one', type: 'account', account_type: 'current', currency: 'GBP' }] })
      }
      assert.ok(url.endsWith('/connected-accounts/one/balance'))
      return Response.json(balance)
    },
  })
  const server = createPilot({ origin, accessCode, tester, client, now: () => now })
  t.after(() => server.close())
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const start = (code = accessCode) => fetch(base + '/bank', {
    method: 'POST', headers: { Origin: origin }, redirect: 'manual',
    body: new URLSearchParams({ code, purchase: '100', bills: '800', buffer: '200' }),
  })
  const complete = (cookie, source = origin) => fetch(base + '/bank/return?connection_id=untrusted', {
    method: 'POST', headers: { Origin: source, Cookie: cookie },
  })
  const openFlow = async () => {
    const response = await start()
    assert.equal(response.status, 303)
    assert.match(response.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/)
    return response.headers.get('set-cookie').split(';')[0]
  }

  assert.equal((await start('wrong')).status, 403)
  assert.equal(calls.length, 0)
  const cookie = await openFlow()
  assert.equal((await complete('')).status, 410)
  assert.equal((await complete(cookie, 'https://elsewhere.example')).status, 403)
  assert.equal((await fetch(base + '/bank/return', { headers: { Cookie: cookie } })).status, 200)
  assert.equal(calls.length, 2)
  const responses = await Promise.all([complete(cookie), complete(cookie)])
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 410])
  const result = responses.find(({ status }) => status === 200)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.match(await result.text(), /£1,225.50.*£800.00.*£200.00.*£100.00.*£125.50/)
  assert.equal(calls.length, 5)

  const expired = await openFlow()
  now += 601_000
  assert.equal((await complete(expired)).status, 410)
  authorized = false
  assert.equal((await complete(await openFlow())).status, 502)
  authorized = true
  balance = { currency: 'GBP', current_balance_in_minor: 125050 }
  assert.equal((await complete(await openFlow())).status, 422)
})
