export function isNativeClient(req) {
  return /\bSPClient\/(?:Windows|Android)\b/i.test(req.headers['user-agent'] || '');
}
