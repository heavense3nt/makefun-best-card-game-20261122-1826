// The rules engine of Ember Clash. Pure state, no DOM: given a state and a move,
// it produces the next state and a list of events the renderer and the sound
// player turn into motion and noise. A match is two fighters, each with life,
// shield, burn, a deck, a hand and energy; turns alternate until one life hits 0.
//
// A turn: the active fighter's shield decays, their burn ticks, their energy
// refills (growing by 1 each of their turns, up to MAX_ENERGY), then they draw.
// Playing a card spends its cost and applies its effect at once. Ending the turn
// passes to the other fighter.
import {
  BURN_TICKS, DECK_SIZE, HAND_LIMIT, MAX_ENERGY, OPENING_HAND, SHIELD_DECAY, START_HP,
} from './config.js';
import { buildDeck } from './cards.js';
import { mulberry32 } from './rng.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

function newFighter(name, isAi, random) {
  return {
    name,
    isAi,
    hp: START_HP,
    maxHp: START_HP,
    shield: 0,
    burn: 0,
    energy: 0,
    maxEnergy: 0,
    deck: buildDeck(random),
    hand: [],
    discard: [],
    damageDealt: 0,
    cardsPlayed: 0,
  };
}

/** A fresh match. `seed` drives both decks; the same seed deals the same game. */
export function newMatch(seed) {
  const random = mulberry32(seed);
  const state = {
    seed,
    phase: PHASE_TITLE,
    round: 1,
    turn: 'player',
    turnCount: 0,
    player: newFighter('Ember Knight', false, random),
    ai: newFighter('Cinder Warden', true, random),
    log: [],
    events: [],
    wins: 0,
    losses: 0,
  };
  return state;
}

function drawCards(fighter, count, state) {
  for (let i = 0; i < count; i += 1) {
    if (fighter.hand.length >= HAND_LIMIT) {
      state.events.push({ type: 'hand-full', who: fighter.name });
      return;
    }
    const card = fighter.deck.pop();
    if (!card) {
      state.events.push({ type: 'deck-empty', who: fighter.name });
      return;
    }
    fighter.hand.push(card);
  }
}

/** Deal the opening hands and start round 1. Called when Play is pressed. */
export function startMatch(state) {
  state.phase = PHASE_PLAY;
  state.round = 1;
  state.turnCount = 0;
  drawCards(state.player, OPENING_HAND, state);
  drawCards(state.ai, OPENING_HAND, state);
  beginTurn(state, state.player);
  state.log.push('The match begins. Ember Knight moves first.');
  return state;
}

/** Run the start-of-turn steps for `fighter`: shield decay, burn tick, energy, draw. */
export function beginTurn(state, fighter) {
  state.turn = fighter.isAi ? 'ai' : 'player';
  if (fighter.shield > 0) {
    const lost = Math.floor(fighter.shield / SHIELD_DECAY);
    fighter.shield -= lost;
    if (lost > 0) state.events.push({ type: 'shield-decay', who: fighter.name, amount: lost });
  }
  if (fighter.burn > 0) {
    const tick = fighter.burn;
    fighter.hp = Math.max(0, fighter.hp - tick);
    state.events.push({ type: 'burn', who: fighter.name, amount: tick });
    fighter.burn = 0;
    if (fighter.hp === 0) {
      finishMatch(state, fighter.isAi ? state.player : fighter);
      return;
    }
  }
  fighter.maxEnergy = Math.min(MAX_ENERGY, fighter.maxEnergy + 1);
  fighter.energy = fighter.maxEnergy;
  drawCards(fighter, 1, state);
  state.events.push({ type: 'turn-start', who: fighter.name, round: state.round });
}

/** Damage after shield: shield soaks first, the rest hits life. Returns life lost. */
function dealDamage(target, amount, state) {
  let left = amount;
  if (target.shield > 0) {
    const soaked = Math.min(target.shield, left);
    target.shield -= soaked;
    left -= soaked;
    if (soaked > 0) state.events.push({ type: 'shield-block', who: target.name, amount: soaked });
  }
  if (left > 0) {
    target.hp = Math.max(0, target.hp - left);
    state.events.push({ type: 'damage', who: target.name, amount: left });
  }
  return left;
}

/**
 * Play the card at `handIndex` from `fighter`'s hand against `opponent`.
 * Returns true when the card was played, false when it cannot be (wrong phase,
 * not that fighter's turn, or not enough energy). Every legal play is logged.
 */
export function playCard(state, fighter, opponent, handIndex) {
  if (state.phase !== PHASE_PLAY) return false;
  if ((fighter.isAi ? 'ai' : 'player') !== state.turn) return false;
  const card = fighter.hand[handIndex];
  if (!card) return false;
  if (card.cost > fighter.energy) return false;
  fighter.hand.splice(handIndex, 1);
  fighter.energy -= card.cost;
  fighter.cardsPlayed += 1;
  fighter.discard.push(card);
  const effect = card.effect;
  if (effect.damage) {
    const dealt = dealDamage(opponent, effect.damage, state);
    fighter.damageDealt += dealt;
  }
  if (effect.shield) {
    fighter.shield += effect.shield;
    state.events.push({ type: 'shield', who: fighter.name, amount: effect.shield });
  }
  if (effect.heal) {
    const healed = Math.min(fighter.maxHp - fighter.hp, effect.heal);
    fighter.hp += healed;
    state.events.push({ type: 'heal', who: fighter.name, amount: healed });
  }
  if (effect.burn) {
    opponent.burn = BURN_TICKS;
    state.events.push({ type: 'burn-applied', who: opponent.name, amount: effect.burn });
  }
  if (effect.draw) drawCards(fighter, effect.draw, state);
  state.events.push({ type: 'card-played', who: fighter.name, card });
  state.log.push(`${fighter.name} plays ${card.name} (${ELEMENT_GLYPH(card)}).`);
  if (opponent.hp === 0) finishMatch(state, fighter);
  return true;
}

function ELEMENT_GLYPH(card) {
  return { flame: '▲', frost: '❄', verdant: '❦', stone: '◆', spark: '✦' }[card.element];
}

/** End the active fighter's turn and hand over to the other side. */
export function endTurn(state) {
  if (state.phase !== PHASE_PLAY) return false;
  const active = state.turn === 'player' ? state.player : state.ai;
  const next = active === state.player ? state.ai : state.player;
  if (next === state.player) state.round += 1;
  state.turnCount += 1;
  state.log.push(`${active.name} ends the turn.`);
  beginTurn(state, next);
  return true;
}

/** Close the match, record the result in the session tally, and log it. */
function finishMatch(state, winner) {
  const playerWon = winner === state.player;
  state.phase = playerWon ? PHASE_WON : PHASE_LOST;
  if (playerWon) state.wins += 1;
  else state.losses += 1;
  state.events.push({ type: 'match-end', winner: winner.name, playerWon });
  state.log.push(playerWon
    ? 'Ember Knight wins the match — the Cinder Warden falls!'
    : 'The Cinder Warden wins the match — the ember fades…');
}

/** The cards the active fighter can afford right now. */
export function affordableCards(state, fighter) {
  return fighter.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.cost <= fighter.energy);
}

export { DECK_SIZE };
