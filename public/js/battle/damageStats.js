export function unitDamageStats(unit, elapsed) {
  const damage = Number.isFinite(unit?.stats?.dmg) ? Math.max(0, unit.stats.dmg) : 0;
  const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return { damage, dps: seconds > 0 ? damage / seconds : 0, seconds };
}

export function battleDamageReport(battle, fieldId) {
  const seconds = Number.isFinite(battle?.time) ? Math.max(0, battle.time) : 0;
  const units = (battle?.allyUnits || []).filter(unit => unit?.kind === 'op').map(unit => ({
    id: unit.id, uid: unit.uid, ownerId: unit.ownerId, name: unit.name || unit.defId || '',
    ...unitDamageStats(unit, seconds),
  })).sort((left, right) => right.damage - left.damage || left.id - right.id);
  return { fieldId, seconds, finished: !!battle?.finished, units };
}
