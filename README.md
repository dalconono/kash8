# Kash8

Run `node demo.mjs` with Node.js 24. Try adult mode with a £65 purchase or teen mode with a £45 purchase. Both use fictional values. The script runs in a terminal and exits after one check.

The adult journey demonstrates the interaction preceding a read-only snapshot. The teen journey demonstrates an educational scenario. The demo uses fixed inputs and has no external services.

The first integration should exercise TrueLayer Data API v3 in sandbox with one-time account information. Start with one supported UK bank, request the minimum data required for the purchase check, and keep credentials and tokens outside the conversation layer. Verify authorisation, refusal, expiry, and an attempted second read. Then verify the results at one bank in the first EU pilot country. Decide what data can be retained independently of access duration.
