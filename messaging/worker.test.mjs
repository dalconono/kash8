import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import worker from './worker.mjs'

const endpoint = 'https://example.test/incoming'
const tester = '+447700900001'
const env = { TWILIO_AUTH_TOKEN: 'fixture-token', KASH8_TESTERS: tester }

function webhook(body, from = `whatsapp:${tester}`, token = env.TWILIO_AUTH_TOKEN) {
  const signature = createHmac('sha1', token)
    .update(endpoint + 'Body' + body + 'From' + from)
    .digest('base64')

  return new Request(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ Body: body, From: from }),
    headers: { 'X-Twilio-Signature': signature },
  })
}

test('replies to each WhatsApp pilot command', async () => {
  for (const [command, expected] of [
    ['LEASE', /£64 short/],
    ['DINNER', /£87 left/],
    ['REVIEW', /£390 left/],
    ['hello', /Reply LEASE, DINNER or REVIEW/],
  ]) {
    const response = await worker.fetch(webhook(command), env)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /^application\/xml/)
    assert.match(await response.text(), expected)
  }
})

test('also accepts an authorised SMS sender', async () => {
  const response = await worker.fetch(webhook('LEASE', tester), env)
  assert.match(await response.text(), /£64 short/)
})

test('returns no reply to callers outside the pilot', async () => {
  const response = await worker.fetch(webhook('LEASE', 'whatsapp:+447700900002'), env)
  assert.equal(await response.text(), '<Response/>')
})

test('rejects invalid signatures and fails closed without secrets', async () => {
  const invalid = await worker.fetch(webhook('LEASE', tester, 'wrong-token'), env)
  assert.equal(invalid.status, 403)
  const unconfigured = await worker.fetch(webhook('LEASE'), {})
  assert.equal(unconfigured.status, 503)
})
