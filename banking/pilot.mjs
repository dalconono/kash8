import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import trueLayer from './truelayer-sandbox.cjs'

const lifetime = 10 * 60 * 1000
const cookie = '__Host-kash8-bank'
const digest = (value) => createHash('sha256').update(value).digest()
const money = (pence) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP',
}).format(pence / 100)

function pence(value) {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value ?? '')
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

function page(response, status, content) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kash8 | Bank sandbox</title><main><h1>Kash8 bank sandbox</h1>${content}</main></html>`)
}

const restart = '<p><a href="/bank">Start a new check</a></p>'
const startForm = `<p>Use a mock bank. Kash8 requests one-time, read-only access to account details and balances in TrueLayer’s sandbox.</p>
<form method="post" action="/bank">
<p><label>Pilot access code <input name="code" type="password" required autocomplete="off"></label></p>
<p><label>Purchase in GBP <input name="purchase" inputmode="decimal" required></label></p>
<p><label>Bills due before next income in GBP <input name="bills" inputmode="decimal" required></label></p>
<p><label>Cash to keep aside in GBP <input name="buffer" inputmode="decimal" required></label></p>
<button>Continue to bank selection</button></form>`

async function form(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return null
  let body = ''
  request.setEncoding('utf8')
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > 2048) return null
  }
  const fields = new URLSearchParams(body)
  return new Set(fields.keys()).size === fields.size ? fields : null
}

export function createPilot({ origin, accessCode, tester, client, now = Date.now }) {
  const canonical = new URL(origin)
  if (canonical.protocol !== 'https:' || origin !== canonical.origin) throw new Error('Set an HTTPS origin')
  if (typeof accessCode !== 'string' || accessCode.length < 32) throw new Error('Set a random pilot access code')
  const secret = digest(accessCode)
  const flows = new Map()
  let starting = 0
  const sweep = setInterval(() => {
    for (const [key, flow] of flows) if (flow.expires <= now()) flows.delete(key)
  }, 30_000).unref()

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Strict-Transport-Security', 'max-age=31536000')
    response.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://app.truelayer-sandbox.com https://app.truelayer.com")
    try {
      const path = new URL(request.url, origin).pathname
      if (!['/bank', '/bank/return'].includes(path)) return page(response, 404, '')
      if (request.method === 'GET' && path === '/bank') return page(response, 200, startForm)
      if (!['GET', 'POST'].includes(request.method)) {
        response.setHeader('Allow', 'GET, POST')
        return page(response, 405, '')
      }
      if (request.method === 'POST' && request.headers.origin !== origin) return page(response, 403, restart)

      const key = new RegExp(`(?:^|;\\s*)${cookie}=([a-f0-9]{64})(?:;|$)`).exec(request.headers.cookie ?? '')?.[1]
      if (path === '/bank') {
        const fields = await form(request)
        if (!fields || !timingSafeEqual(secret, digest(fields.get('code') ?? ''))) {
          return page(response, 403, '<p>Check your pilot access code.</p>' + restart)
        }
        const [purchase, bills, buffer] = ['purchase', 'bills', 'buffer'].map((field) => pence(fields.get(field)))
        if ([purchase, bills, buffer].includes(null)) return page(response, 400, '<p>Enter all three amounts in pounds and pence.</p>' + restart)
        if (flows.size + starting >= 25) return page(response, 429, '<p>The pilot is busy. Try again shortly.</p>' + restart)
        starting++
        try {
          const result = await client.start(tester)
          const hosted = new URL(result.hosted_page.uri)
          if (result.status !== 'authorization_required' || !/^[\w-]{1,128}$/.test(result.id ?? '') ||
              !['https://app.truelayer-sandbox.com', 'https://app.truelayer.com'].includes(hosted.origin) ||
              hosted.username || hosted.password || !hosted.pathname.startsWith('/data/')) {
            throw new Error('Unexpected sandbox connection')
          }
          const session = randomBytes(32).toString('hex')
          flows.delete(key)
          flows.set(session, { id: result.id, purchase, bills, buffer, expires: now() + lifetime })
          response.writeHead(303, {
            Location: hosted.href,
            'Set-Cookie': `${cookie}=${session}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
          }).end()
        } finally {
          starting--
        }
        return
      }

      const flow = flows.get(key)
      if (!flow || flow.expires <= now()) {
        flows.delete(key)
        return page(response, 410, '<p>This check has expired or already finished.</p>' + restart)
      }
      if (request.method === 'GET') {
        return page(response, 200, '<form method="post" action="/bank/return"><button>Read balance and calculate</button></form>' + restart)
      }

      flows.delete(key)
      response.setHeader('Set-Cookie', `${cookie}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`)
      const cash = await client.readBalance(flow.id)
      const remaining = cash - flow.purchase - flow.bills - flow.buffer
      if (cash === null || !Number.isSafeInteger(remaining) || Math.abs(cash) > 1e12) {
        return page(response, 422, '<p>This check needs exactly one GBP current account with complete balance and overdraft information.</p>' + restart)
      }
      const verdict = remaining < 0
        ? `You would be ${money(-remaining)} short of this plan.`
        : `You would have ${money(remaining)} left above your cash buffer.`
      page(response, 200, `<p>${verdict}</p>
<p>${money(cash)} sandbox balance after accounting for overdraft and pending activity − ${money(flow.bills)} bills − ${money(flow.buffer)} cash buffer − ${money(flow.purchase)} purchase = ${money(remaining)}.</p>
<p>Based on one account, the bank snapshot retrieved at ${new Date(now()).toISOString()}, and the bills you entered.</p>${restart}`)
    } catch {
      page(response, 502, '<p>The sandbox check could not finish. If bank approval was cancelled, declined or expired, start again to request fresh access.</p>' + restart)
    }
  })
  server.on('close', () => clearInterval(sweep))
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { KASH8_BANK_ORIGIN: origin, KASH8_BANK_ACCESS_CODE: accessCode,
    TRUELAYER_CLIENT_ID: clientId, TRUELAYER_CLIENT_SECRET: clientSecret, PORT = '8788' } = process.env
  const client = trueLayer.sandboxClient({ clientId, clientSecret, callbackUrl: new URL('/bank/return', origin).href })
  createPilot({
    origin, accessCode, client, tester: { name: 'Kash8 Sandbox Tester', email: 'tester@example.com' },
  }).listen(Number(PORT), '127.0.0.1')
}
