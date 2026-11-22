// The table of Ember Clash: every pixel the player sees is built here, from the
// engine state and nothing else. Cards are DOM elements so their values, costs
// and suits stay readable at any size; the layout is a felt table with the
// opponent across the top, the player along the bottom, and the log at the side.
import { ELEMENTS } from './cards.js';

const $ = (id) => document.getElementById(id);

/** One card face: cost gem, element glyph, name, art band, rules text. */
export function cardElement(card, { playable = false, selected = false, faceDown = false, index = 0 } = {}) {
  const element = ELEMENTS[card.element];
  const el = document.createElement('button');
  el.className = `card el-${card.element}${playable ? ' playable' : ''}${selected ? ' selected' : ''}${faceDown ? ' face-down' : ''}`;
  el.type = 'button';
  el.dataset.index = String(index);
  el.setAttribute('aria-label', faceDown ? 'Face-down card' : `${card.name}, cost ${card.cost}. ${card.text}`);
  if (faceDown) {
    el.innerHTML = `<span class="card-back">♠</span><span class="card-back-name">EMBER<br>CLASH</span>`;
    return el;
  }
  el.innerHTML = `
    <span class="card-cost" style="--el:${element.color}">${card.cost}</span>
    <span class="card-glyph" style="color:${element.color}">${element.glyph}</span>
    <span class="card-name">${card.name}</span>
    <span class="card-art" style="--el:${element.color}"><span class="card-art-glyph">${element.glyph}</span></span>
    <span class="card-text">${card.text}</span>
    <span class="card-element">${element.label}</span>`;
  return el;
}

function hpBar(fighter) {
  const pct = Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100));
  const low = pct <= 25 ? ' low' : '';
  return `<div class="hpbar${low}" role="meter" aria-valuenow="${fighter.hp}" aria-valuemax="${fighter.maxHp}">
    <div class="hpfill" style="width:${pct}%"></div>
    <span class="hptext">♥ ${fighter.hp} / ${fighter.maxHp}</span>
  </div>`;
}

function shieldBadge(fighter) {
  return fighter.shield > 0 ? `<span class="shield-badge" title="Shield absorbs damage first">🛡 ${fighter.shield}</span>` : '';
}

function burnBadge(fighter) {
  return fighter.burn > 0 ? `<span class="burn-badge" title="Burn: takes damage at the start of its turn">🔥 Burn ${fighter.burn}</span>` : '';
}

function energyCrystals(fighter) {
  let crystals = '';
  for (let i = 0; i < fighter.maxEnergy; i += 1) {
    crystals += `<span class="crystal${i < fighter.energy ? ' full' : ''}">◆</span>`;
  }
  return `<div class="energy" title="Energy — refills each turn">${crystals}<span class="energy-num">${fighter.energy}/${fighter.maxEnergy}</span></div>`;
}

/** Render the opponent's row: portrait, life, hand backs, deck and discard counts. */
function renderOpponent(state) {
  const ai = state.ai;
  const backs = $('ai-hand');
  backs.innerHTML = '';
  ai.hand.forEach((card, i) => backs.appendChild(cardElement(card, { faceDown: true, index: i })));
  $('ai-name').textContent = ai.name;
  $('ai-vitals').innerHTML = hpBar(ai) + shieldBadge(ai) + burnBadge(ai);
  $('ai-deck').textContent = `Deck ${ai.deck.length} · Discard ${ai.discard.length}`;
  $('ai-status').textContent = state.turn === 'ai' && state.phase === 'play' ? 'thinking…' : '';
}

/** Render the player's row: life, energy, hand, and the end-turn control. */
function renderPlayer(state) {
  const player = state.player;
  const hand = $('player-hand');
  hand.innerHTML = '';
  player.hand.forEach((card, i) => {
    const playable = state.phase === 'play' && state.turn === 'player' && card.cost <= player.energy;
    const el = cardElement(card, { playable, index: i });
    el.addEventListener('click', () => window.__emberPlayCard(i));
    hand.appendChild(el);
  });
  $('player-name').textContent = player.name;
  $('player-vitals').innerHTML = hpBar(player) + shieldBadge(player) + burnBadge(player);
  $('player-energy').innerHTML = energyCrystals(player);
  $('player-deck').textContent = `Deck ${player.deck.length} · Discard ${player.discard.length}`;
  const endTurn = $('end-turn');
  endTurn.disabled = !(state.phase === 'play' && state.turn === 'player');
  endTurn.textContent = state.turn === 'player' ? 'End Turn ⏎' : 'Cinder Warden’s turn…';
}

/** Render the match log (last 6 entries) and the score tally. */
function renderSide(state) {
  const log = $('match-log');
  log.innerHTML = '';
  state.log.slice(-6).forEach((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    log.appendChild(item);
  });
  $('round-label').textContent = `Round ${state.round}`;
  $('score-label').textContent = `You ${state.wins} — ${state.losses} Warden`;
  $('turn-banner').textContent = state.phase === 'play'
    ? (state.turn === 'player' ? 'Your turn — play a card or end the turn' : 'Cinder Warden is thinking…')
    : '';
}

/** Show one screen (title / table / end) and hide the others. */
export function showScreen(name) {
  for (const screen of ['title', 'table', 'end']) {
    $(`screen-${screen}`).hidden = screen !== name;
  }
}

/** Fill the end screen with the result, the match stats and the tally. */
export function renderEnd(state) {
  const won = state.phase === 'won';
  $('end-title').textContent = won ? 'VICTORY!' : 'DEFEAT';
  $('end-title').className = won ? 'end-title win' : 'end-title lose';
  $('end-subtitle').textContent = won
    ? 'The Cinder Warden falls. The ember is yours.'
    : 'The ember fades… The Warden keeps the table. Rematch?';
  $('end-stats').innerHTML = `
    <span>Rounds played: <b>${state.round}</b></span>
    <span>Damage you dealt: <b>${state.player.damageDealt}</b></span>
    <span>Cards you played: <b>${state.player.cardsPlayed}</b></span>
    <span>Session: <b>You ${state.wins} — ${state.losses} Warden</b></span>`;
}

/** Re-render the whole table from the current state. */
export function renderTable(state) {
  renderOpponent(state);
  renderPlayer(state);
  renderSide(state);
}

/** A floating damage number over a fighter's portrait. */
export function damagePop(who, amount, kind = 'damage') {
  const target = who === 'player' ? $('player-portrait') : $('ai-portrait');
  if (!target) return;
  const pop = document.createElement('span');
  pop.className = `damage-pop ${kind}`;
  pop.textContent = kind === 'heal' ? `+${amount}` : `−${amount}`;
  target.appendChild(pop);
  window.setTimeout(() => pop.remove(), 750);
}
