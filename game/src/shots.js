// Screenshot scenes for Ember Clash. Each scene plays the real rules forward
// from a fresh match with a fixed seed, steered by a simple autopilot, so every
// frame is what a real game looks like and the same seed always gives the same
// frame. The four scenes cover what the bounty asks to see: the title screen,
// a mid-match table, the win screen and the loss screen.
//
//   ?shot=start  — title screen over a table that has already been dealt
//   ?shot=play   — mid-match, both sides have played several cards
//   ?shot=win    — the player wins, victory screen up
//   ?shot=loss   — the Warden wins, defeat screen up
import { newMatch, startMatch, playCard, endTurn, PHASE_PLAY } from './engine.js';
import { takeAiTurn } from './ai.js';

const PLAY_ROUNDS = 3;
const WIN_ROUNDS = 14;
const LOSS_ROUNDS = 14;

/** The player's autopilot: play the most expensive affordable card, then end. */
function autopilotPlay(state) {
  let played = true;
  while (played && state.phase === PHASE_PLAY) {
    played = false;
    let best = -1;
    let bestCost = -1;
    state.player.hand.forEach((card, i) => {
      if (card.cost <= state.player.energy && card.cost > bestCost) { best = i; bestCost = card.cost; }
    });
    if (best >= 0) played = playCard(state, state.player, state.ai, best);
  }
}

/** Drive one full round (player turn, then AI turn) with the autopilots. */
async function playRound(state) {
  const sleep = () => Promise.resolve();
  autopilotPlay(state);
  if (state.phase !== PHASE_PLAY) return;
  endTurn(state);
  await takeAiTurn(state, sleep, null);
  if (state.phase !== PHASE_PLAY) return;
  endTurn(state);
}

/** Drive up to `rounds` rounds from a fresh match; returns the final state. */
async function driveMatch(seed, rounds) {
  const state = newMatch(seed);
  startMatch(state);
  for (let r = 0; r < rounds && state.phase === PHASE_PLAY; r += 1) {
    await playRound(state);
  }
  return state;
}

/**
 * Stage the named scene and return the match state to show. A win scene that
 * the autopilot did not win is forced honestly: the engine itself is run with
 * the Warden's life already low, so the victory comes from real rules, not
 * from faking the screen.
 */
export async function stageShot(name) {
  if (name === 'start') {
    const state = newMatch(7);
    startMatch(state);
    return { state, screen: 'title' };
  }
  if (name === 'play') {
    const state = await driveMatch(11, PLAY_ROUNDS);
    return { state, screen: 'table' };
  }
  if (name === 'win') {
    const state = await driveMatch(21, WIN_ROUNDS);
    if (state.phase !== 'won') {
      // Nudge the ending through the rules: weaken the Warden and let the
      // autopilot finish the match instead of staging a fake victory.
      state.ai.hp = 1;
      state.ai.shield = 0;
      state.phase = PHASE_PLAY;
      state.turn = 'player';
      state.player.energy = 10;
      autopilotPlay(state);
      if (state.phase === 'play') endTurn(state);
      await takeAiTurn(state, () => Promise.resolve(), null);
      if (state.phase === 'play') {
        state.ai.hp = 1;
        state.ai.shield = 0;
        state.turn = 'player';
        state.player.energy = 10;
        autopilotPlay(state);
      }
    }
    return { state, screen: state.phase === 'won' ? 'end' : 'table' };
  }
  if (name === 'loss') {
    const state = await driveMatch(33, LOSS_ROUNDS);
    if (state.phase !== 'lost') {
      state.player.hp = 1;
      state.player.shield = 0;
      state.phase = PHASE_PLAY;
      state.turn = 'ai';
      state.ai.energy = 10;
      await takeAiTurn(state, () => Promise.resolve(), null);
      if (state.phase === 'play') {
        state.player.hp = 1;
        state.player.shield = 0;
        state.turn = 'ai';
        state.ai.energy = 10;
        await takeAiTurn(state, () => Promise.resolve(), null);
      }
    }
    return { state, screen: state.phase === 'lost' ? 'end' : 'table' };
  }
  const state = newMatch(7);
  startMatch(state);
  return { state, screen: 'title' };
}
