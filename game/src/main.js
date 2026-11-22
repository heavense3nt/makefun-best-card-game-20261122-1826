// Ember Clash — wiring. This file owns the session: it holds the current match,
// starts the AI's turns, turns engine events into sounds and floating numbers,
// and handles mouse and keyboard input. The rules live in engine.js, the
// opponent's brain in ai.js, the pixels in render.js.
import { newMatch, startMatch, playCard, endTurn, PHASE_PLAY } from './engine.js';
import { takeAiTurn } from './ai.js';
import { renderTable, renderEnd, showScreen, damagePop } from './render.js';
import { sounds, playEventSound, setMuted, isMuted } from './audio.js';
import { stageShot } from './shots.js';
import { AI_THINK_MS } from './config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let state = newMatch(Date.now() % 2147483647);
let aiRunning = false;

function refresh() {
  if (state.phase === 'won' || state.phase === 'lost') {
    renderTable(state);
    renderEnd(state);
    showScreen('end');
  } else if (state.phase === PHASE_PLAY) {
    renderTable(state);
    showScreen('table');
  } else {
    showScreen('title');
  }
}

/** Drain the events the engine queued and turn each into sound or motion. */
function drainEvents() {
  for (const event of state.events.splice(0)) {
    playEventSound(event);
    if (event.type === 'damage') damagePop(event.who === state.player.name ? 'player' : 'ai', event.amount, 'damage');
    if (event.type === 'heal') damagePop(event.who === state.player.name ? 'player' : 'ai', event.amount, 'heal');
  }
}

/** The player plays the card at hand index `i`. The turn stays with the player
 * afterwards: they may play more cards, and only End Turn hands over to the
 * Warden. (An earlier version answered after a single card, which both cut the
 * player's turn short and left the AI waiting on the wrong turn.) */
async function playPlayerCard(i) {
  if (aiRunning || state.phase !== PHASE_PLAY || state.turn !== 'player') return;
  const played = playCard(state, state.player, state.ai, i);
  if (!played) {
    sounds.click();
    return;
  }
  drainEvents();
  refresh();
}

/** Run the Warden's turn with pauses, then hand back to the player. */
async function runAiTurn() {
  aiRunning = true;
  refresh();
  await sleep(AI_THINK_MS);
  await takeAiTurn(state, sleep, () => {
    drainEvents();
    refresh();
  });
  drainEvents();
  refresh();
  if (state.phase === PHASE_PLAY) {
    endTurn(state);
    drainEvents();
    refresh();
  }
  aiRunning = false;
}

async function endPlayerTurn() {
  if (aiRunning || state.phase !== PHASE_PLAY || state.turn !== 'player') return;
  sounds.click();
  endTurn(state);
  drainEvents();
  refresh();
  if (state.phase === PHASE_PLAY) await runAiTurn();
}

function startNewMatch() {
  const wins = state.wins;
  const losses = state.losses;
  state = newMatch(Date.now() % 2147483647);
  state.wins = wins;
  state.losses = losses;
  startMatch(state);
  drainEvents();
  refresh();
}

function backToTitle() {
  const { wins, losses } = state;
  state = newMatch(Date.now() % 2147483647);
  state.wins = wins;
  state.losses = losses;
  refresh();
}

// The renderer calls this when a card in the player's hand is clicked.
window.__emberPlayCard = (i) => void playPlayerCard(i);

document.getElementById('play-button').addEventListener('click', () => {
  sounds.click();
  startNewMatch();
});
document.getElementById('how-button').addEventListener('click', () => {
  sounds.click();
  document.getElementById('how-to').hidden = !document.getElementById('how-to').hidden;
});
document.getElementById('end-turn').addEventListener('click', () => void endPlayerTurn());
document.getElementById('again-button').addEventListener('click', () => {
  sounds.click();
  startNewMatch();
});
document.getElementById('title-button').addEventListener('click', () => {
  sounds.click();
  backToTitle();
});
document.getElementById('mute-button').addEventListener('click', (event) => {
  setMuted(!isMuted());
  event.currentTarget.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
});

// Keyboard: 1–7 play a card, Enter/Space ends the turn, Esc returns to the title.
document.addEventListener('keydown', (event) => {
  if (event.key >= '1' && event.key <= '7') void playPlayerCard(Number(event.key) - 1);
  else if ((event.key === 'Enter' || event.key === ' ') && state.phase === PHASE_PLAY) void endPlayerTurn();
  else if (event.key === 'Escape' && state.phase !== 'title') backToTitle();
});

// Screenshot mode: ?shot=start|play|win|loss stages a fixed-seed scene and
// sets window.__shotReady once two frames have rendered, for the shot driver.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const seed = Number(params.get('seed') ?? 1);
  void stageShot(shotName, seed).then(({ state: staged, screen }) => {
    state = staged;
    if (screen === 'end') {
      renderTable(state);
      renderEnd(state);
      showScreen('end');
    } else if (screen === 'table') {
      renderTable(state);
      showScreen('table');
    } else {
      renderTable(state);
      showScreen('title');
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
    }));
  });
} else {
  refresh();
}
