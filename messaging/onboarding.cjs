// Use a Protected Twilio Function. Set the onboarding URL only after that page is deployed.
function onboardingReply(body, onboardingUrl) {
  if (!/^(hi|hello|hey|start|connect(?: my)? (?:bank|accounts?)|check my accounts)[!.?]*$/i.test(body.trim())) {
    return null
  }
  const lines = [
    '*Welcome to Kash8*',
    '',
    'Ask a question about your money, or connect an account for a one-time, read-only balance check.',
    '',
    '*What you’ll approve*',
    'You choose the bank and see the access request before approving in your bank’s app. Kash8 can read the balances you approve. It cannot move money.',
  ]
  if (onboardingUrl) {
    const url = new URL(onboardingUrl)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid onboarding URL')
    lines.push('', '*Set up your profile and choose a bank*', url.href)
  } else {
    lines.push('', 'Bank setup is not available on this number yet.')
  }
  return lines.join('\n')
}

module.exports = { onboardingReply }
