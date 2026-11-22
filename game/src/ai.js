// The Cinder Warden's brain. A readable heuristic, not a black box: every choice
// scores the card in the current position, so its plays can be followed and
// countered — heal when hurt, shield when threatened, strike when it wins.
//
// Scoring, per card, in the position it is played from:
//   damage is worth its face value, double when it ends the match;
//   shield is worth more the lower the Warden's life and the harder the player hits;
//   healing is worth what it actually restores, more when life is low;
//   draw is worth a little now and more with energy left to spend;
//   burn is worth the damage it will tick plus a nudge for the pressure it adds.
// The AI plays its best affordable card while any card scores above zero, then
// ends its turn.
import { playCard, affordableCards } from './engine.js';

const LETHAL_BONUS = 100;
const DRAW_VALUE = 2.5;
const BURN_VALUE = 3;

function scoreCard(state, ai, player, card) {
  const effect = card.effect;
  let score = 0;
  if (effect.damage) {
    score += effect.damage;
    if (effect.damage >= player.hp + player.shield) score += LETHAL_BONUS;
  }
  if (effect.shield) {
    const danger = Math.max(0, 20 - ai.hp) / 20; // 0 when healthy, 1 near death
    score += effect.shield * (0.5 + danger);
  }
  if (effect.heal) {
    const missing = ai.maxHp - ai.hp;
    const restored = Math.min(missing, effect.heal);
    score += restored * (missing > 12 ? 1.4 : 0.7);
  }
  if (effect.draw) score += DRAW_VALUE * effect.draw * (ai.energy - card.cost > 0 ? 1 : 0.4);
  if (effect.burn) score += BURN_VALUE + effect.burn;
  // A cheap card that does something beats holding energy for nothing.
  score -= card.cost * 0.4;
  return score;
}

/**
 * Take the whole AI turn: play cards one at a time until none is worth playing,
 * then end the turn. `onStep` is called after each card so the UI can animate
 * the play; it receives the card just played. Returns a promise that resolves
 * when the turn is over.
 */
export async function takeAiTurn(state, sleep, onStep) {
  const ai = state.ai;
  const player = state.player;
  while (state.phase === 'play' && state.turn === 'ai') {
    const options = affordableCards(state, ai)
      .map(({ card, index }) => ({ card, index, score: scoreCard(state, ai, player, card) }))
      .filter((option) => option.score > 0)
      .sort((a, b) => b.score - a.score);
    if (options.length === 0) break;
    const best = options[0];
    const played = playCard(state, ai, player, best.index);
    if (!played) break;
    if (onStep) onStep(best.card);
    await sleep(520);
  }
  return state;
}
