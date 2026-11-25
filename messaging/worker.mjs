import { scenarios } from '../dist/scenarios.mjs'

const menu = 'Kash8 demo. Reply LEASE, DINNER or REVIEW to try a sample money check.'
const commands = { lease: 'lease', dinner: 'dinner', review: 'health' }
const encoder = new TextEncoder()
const xmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

export function replyTo(body) {
  const command = body.trim().toLowerCase()
  if (!Object.hasOwn(commands, command)) return menu
  const scenario = scenarios[commands[command]]
  return `Sample data • ${scenario.answer} ${scenario.next}`
}

async function verify(url, fields, signature, secret) {
  if (!signature || !secret) return false
  let received
  try {
    received = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0))
  } catch {
    return false
  }
  const payload = [...fields.keys()].sort().reduce(
    (value, key) => value + key + fields.get(key),
    url,
  )
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, received, encoder.encode(payload))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/incoming') return new Response(null, { status: 404 })
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    }
    if (!env.TWILIO_AUTH_TOKEN || !env.KASH8_TESTERS) {
      return new Response(null, { status: 503 })
    }
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      return new Response(null, { status: 415 })
    }
    const fields = new URLSearchParams(await request.text())
    if (new Set(fields.keys()).size !== fields.size) return new Response(null, { status: 400 })
    if (!await verify(request.url, fields, request.headers.get('x-twilio-signature'), env.TWILIO_AUTH_TOKEN)) {
      return new Response(null, { status: 403 })
    }
    const sender = fields.get('From')?.replace(/^whatsapp:/, '')
    const testers = env.KASH8_TESTERS.split(',').map((value) => value.trim()).filter(Boolean)
    const message = sender && testers.includes(sender) ? replyTo(fields.get('Body') ?? '') : ''
    const escaped = message.replace(/[&<>"']/g, (char) => xmlEscapes[char])
    const xml = escaped ? `<Response><Message>${escaped}</Message></Response>` : '<Response/>'
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
  },
}
