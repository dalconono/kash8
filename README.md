# Kash8

[Open the private phone preview](https://kash8-money-coach.filippo-dalconzo06.chatgpt.site)

The browser demo at `dist/index.html` runs with fictional values and requires no dependencies. Open the file locally or use the hosted preview. Choose Payday or Pocket money, pick GBP or EUR and enter a purchase to see the calculation. The one-time approval in Payday is simulated. A terminal demo is also available via `node demo.mjs` on Node.js 24.

## First bank integration

Use TrueLayer Data API v3 in sandbox. Enable Data API in the provider console and register the deployed backend callback URL. Keep the sandbox client ID and secret in server configuration. The static preview has no backend and cannot store secrets. GitHub holds the frontend source. The current Sites preview is a separately published copy.

1. The signed-in user initiates a check. The backend creates a short-lived flow tied to their session and creates a `one_time` connection with only the account-information scopes the current check needs. Start with accounts and balances. Collect upcoming bills and reserves separately.
2. Redirect to the provider-hosted authorisation flow. Validate the return against the initiating session, and verify the provider-side connection status before retrieving a balance. Handle denial, expiry and duplicate callbacks.
3. Fetch the snapshot within the access window. Record its currency and freshness, compute the result in integer minor units, then discard the credentials for the completed check. A new check initiates a new connection. Retaining any financial summary is a separate decision to disclose before authorisation.
4. Test success, denial, expiry, repeat requests, unavailable balances and multi-account currency differences using sandbox accounts. Start with one UK bank before expanding into one EU market. Keep the teen experience manual while eligibility and age-appropriate design are assessed.

## Conversation and evaluation

Use a general-purpose language model to identify the question, request missing facts and explain calculator results. Give it structured functions to check a purchase, summarise transactions or compare financing scenarios as those features are built. Keep bank credentials and access tokens on the backend. Start with a versioned evaluation set of representative questions, including pending transactions, refunds, internal transfers, missing bills and unclear currency. Use a reviewed UK and EU knowledge base for education. Validate outputs and require the model to ask when an input is unknown.

After the bank flow works on mobile, add SMS entry links. Consider WhatsApp after confirming the business platform eligibility of the specific finance experience. Keep account details inside the signed-in web experience.
