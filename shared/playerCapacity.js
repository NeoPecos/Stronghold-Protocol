import { BASE_SEATS, MAX_SEATS, MAX_DRAFT_CARDS } from './constants.js';

export const MIN_COOP_DRAFT_CARDS = MAX_DRAFT_CARDS;
export const GROUPED_POOL_MIN_PLAYERS = BASE_SEATS + 1;
export const MAX_UNITE_ROUNDS = 5;
export const MAX_UNITE_HELPERS = MAX_UNITE_ROUNDS * 2;
export const UNITE_TIME_BONUS_PER_PAIR = 10;

export function coopDraftCardCount() { return MIN_COOP_DRAFT_CARDS; }

export function poolGroupSizes(players) {
  if (!Number.isInteger(players) || players < 1 || players > MAX_SEATS) throw new RangeError('invalid player count');
  if (players < GROUPED_POOL_MIN_PLAYERS) return [players];
  const groups = [];
  for (let remaining = players; remaining > 0; remaining -= BASE_SEATS) groups.push(Math.min(BASE_SEATS, remaining));
  return groups;
}

export function orderedGroupIds(seats, savedOrder = null) {
  const occupied = seats.filter(Boolean).sort((left, right) => left.seat - right.seat);
  const byId = new Set(occupied.map((seat) => seat.playerId));
  const ordered = [];
  const seen = new Set();
  if (Array.isArray(savedOrder)) for (const id of savedOrder.flat()) {
    if (byId.has(id) && !seen.has(id)) { ordered.push(id); seen.add(id); }
  }
  for (const seat of occupied) if (!seen.has(seat.playerId)) ordered.push(seat.playerId);
  return ordered;
}

export function poolGroupMembers(seats, savedOrder = null) {
  const ordered = orderedGroupIds(seats, savedOrder);
  if (!ordered.length) return [];
  if (Array.isArray(savedOrder) && savedOrder.some(Array.isArray)) {
    const occupied = new Set(ordered);
    const seen = new Set();
    const groups = [];
    for (const saved of savedOrder) {
      if (!Array.isArray(saved)) continue;
      const members = saved.filter((id) => occupied.has(id) && !seen.has(id));
      for (const id of members) seen.add(id);
      for (let offset = 0; offset < members.length; offset += BASE_SEATS) groups.push(members.slice(offset, offset + BASE_SEATS));
    }
    for (const id of ordered) {
      if (seen.has(id)) continue;
      let group = groups.find((members) => members.length < BASE_SEATS);
      if (!group) { group = []; groups.push(group); }
      group.push(id);
    }
    return groups;
  }
  const sizes = poolGroupSizes(ordered.length);
  let offset = 0;
  return sizes.map((size) => {
    const group = ordered.slice(offset, offset + size);
    offset += size;
    return group;
  });
}

export function roomGroupMembers(seats, capacity, savedOrder = null) {
  const groupCount = Math.max(1, Math.ceil(capacity / BASE_SEATS));
  const groups = Array.from({ length: groupCount }, () => []);
  const ordered = orderedGroupIds(seats, savedOrder);
  const occupied = new Set(ordered);
  const seatById = new Map(seats.filter(Boolean).map((seat) => [seat.playerId, seat.seat]));
  const assigned = new Set();
  if (Array.isArray(savedOrder) && savedOrder.some(Array.isArray)) {
    for (let index = 0; index < Math.min(groupCount, savedOrder.length); index++) {
      const saved = savedOrder[index];
      if (!Array.isArray(saved)) continue;
      for (const id of saved) {
        if (!occupied.has(id) || assigned.has(id) || groups[index].length >= BASE_SEATS) continue;
        groups[index].push(id);
        assigned.add(id);
      }
    }
  } else if (Array.isArray(savedOrder) && savedOrder.length) {
    for (let index = 0; index < ordered.length; index++) {
      groups[Math.floor(index / BASE_SEATS)].push(ordered[index]);
      assigned.add(ordered[index]);
    }
  }
  for (const id of ordered) {
    if (assigned.has(id)) continue;
    const preferred = groups[Math.floor((seatById.get(id) ?? 0) / BASE_SEATS)];
    const group = preferred?.length < BASE_SEATS ? preferred : groups.find((members) => members.length < BASE_SEATS);
    if (!group) break;
    group.push(id);
  }
  return groups;
}

export const poolCopyScale = (groupSize) => Math.max(1, groupSize / BASE_SEATS);

export const uniteRoundLimit = (poolGroupCount) => Number.isInteger(poolGroupCount)
  ? Math.max(1, Math.min(MAX_UNITE_ROUNDS, poolGroupCount)) : 1;

export function uniteHelperLimit(players) {
  if (!Number.isInteger(players) || players < 1 || players > MAX_SEATS) throw new RangeError('invalid player count');
  return Math.min(MAX_UNITE_HELPERS, Math.max(2, Math.floor(players / BASE_SEATS) * 2));
}

export function uniteHelperOptions(players) {
  return Array.from({ length: uniteHelperLimit(players) / 2 }, (_, index) => (index + 1) * 2);
}

export function uniteTimeBonus(players, helpers) {
  const limit = uniteHelperLimit(players);
  if (!Number.isInteger(helpers) || helpers < 2 || helpers > limit || helpers % 2 !== 0) throw new RangeError('invalid unite helper count');
  return (limit - helpers) / 2 * UNITE_TIME_BONUS_PER_PAIR;
}

export const coopHiddenLayerThreshold = (baseline, players) => Math.ceil(baseline * Math.max(1, players / BASE_SEATS));
