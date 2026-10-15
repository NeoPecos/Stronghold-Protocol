export function bossGroupCredit(rawDamage, quota, assistRate = 0.5) {
  const raw = Math.max(0, Number(rawDamage) || 0);
  const normal = Math.max(0, Number(quota) || 0);
  return Math.min(raw, normal) + Math.max(0, raw - normal) * assistRate;
}

export function bossRawForCredit(rawBefore, credit, quota, assistRate = 0.5) {
  const before = Math.max(0, Number(rawBefore) || 0);
  const wanted = Math.max(0, Number(credit) || 0);
  const normalLeft = Math.max(0, quota - before);
  return Math.min(wanted, normalLeft) + Math.max(0, wanted - normalLeft) / assistRate;
}
