# Kash8 phone pilot

The inbound endpoint can reply to LEASE, DINNER or REVIEW using the website's sample data. It accepts inbound SMS or WhatsApp requests from Twilio. There are no bank calls or AI model calls in this pilot.

Deploy from the repository root with `npx wrangler deploy --config messaging/wrangler.toml` in an authorised Cloudflare account. Use `npx wrangler secret put TWILIO_AUTH_TOKEN --config messaging/wrangler.toml` to configure the Twilio account auth token and `npx wrangler secret put KASH8_TESTERS --config messaging/wrangler.toml` for a comma-separated list of authorised E.164 tester numbers. Keep these values in the hosting account.

Configure Twilio to send POST requests to the exact HTTPS Worker URL ending in `/incoming`. The handler verifies Twilio's signature using that URL. For WhatsApp, activate the Twilio Sandbox, configure its incoming webhook and join from each authorised tester's phone. For SMS, set the inbound messaging webhook on an SMS-capable Twilio number.

[Twilio WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/quickstart) · [Twilio webhook signatures](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
