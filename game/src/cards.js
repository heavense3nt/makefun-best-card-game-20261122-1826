// The card catalogue of Ember Clash. Every card belongs to one of five elements,
// each told apart by colour and by glyph, never by text alone:
//   flame  ▲  red     — raw damage
//   frost  ❄  blue    — damage plus a little shield
//   verdant ❦  green  — healing
//   stone  ◆  slate   — shield
//   spark  ✦  amber   — card draw and cheap pokes
// A card's effect is a small plain object the engine reads: damage, shield, heal,
// draw and burn. Nothing here knows about the DOM; the engine applies effects.
import { DECK_SIZE } from './config.js';
import { shuffle } from './rng.js';

export const ELEMENTS = {
  flame: { glyph: '▲', label: 'Flame', color: '#e5484d' },
  frost: { glyph: '❄', label: 'Frost', color: '#4aa8ff' },
  verdant: { glyph: '❦', label: 'Verdant', color: '#46a758' },
  stone: { glyph: '◆', label: 'Stone', color: '#9b8fa8' },
  spark: { glyph: '✦', label: 'Spark', color: '#f5b301' },
};

/**
 * One card definition. `effect` holds the numbers the engine applies;
 * `text` is the one-line rules text printed on the card face.
 */
export const CATALOGUE = [
  { id: 'ember-wisp', name: 'Ember Wisp', element: 'spark', cost: 0,
    effect: { damage: 2 }, text: 'Deal 2 damage.' },
  { id: 'stonewall', name: 'Stonewall', element: 'stone', cost: 1,
    effect: { shield: 6 }, text: 'Gain 6 shield.' },
  { id: 'spark-surge', name: 'Spark Surge', element: 'spark', cost: 1,
    effect: { draw: 2 }, text: 'Draw 2 cards.' },
  { id: 'ashen-veil', name: 'Ashen Veil', element: 'stone', cost: 1,
    effect: { shield: 4, draw: 1 }, text: 'Gain 4 shield. Draw 1 card.' },
  { id: 'ember-slash', name: 'Ember Slash', element: 'flame', cost: 2,
    effect: { damage: 5 }, text: 'Deal 5 damage.' },
  { id: 'frostbite', name: 'Frostbite', element: 'frost', cost: 2,
    effect: { damage: 3, shield: 3 }, text: 'Deal 3 damage. Gain 3 shield.' },
  { id: 'verdant-mend', name: 'Verdant Mend', element: 'verdant', cost: 2,
    effect: { heal: 6 }, text: 'Restore 6 life.' },
  { id: 'cinder-burst', name: 'Cinder Burst', element: 'flame', cost: 3,
    effect: { damage: 6, burn: 2 }, text: 'Deal 6 damage. Burn 2.' },
  { id: 'magma-lance', name: 'Magma Lance', element: 'flame', cost: 3,
    effect: { damage: 7 }, text: 'Deal 7 damage.' },
  { id: 'wildfire', name: 'Wildfire', element: 'flame', cost: 4,
    effect: { damage: 10 }, text: 'Deal 10 damage.' },
];

// How many copies of each card a deck holds. The deck is the same mix for both
// sides, so every match is decided by the draw and the plays, not the list.
const DECK_MIX = {
  'ember-wisp': 4,
  'stonewall': 4,
  'spark-surge': 3,
  'ashen-veil': 3,
  'ember-slash': 4,
  'frostbite': 3,
  'verdant-mend': 3,
  'cinder-burst': 2,
  'magma-lance': 2,
  'wildfire': 2,
};

/** Build a fresh shuffled deck of DECK_SIZE cards, each a copy of its definition. */
export function buildDeck(random) {
  const deck = [];
  for (const card of CATALOGUE) {
    const copies = DECK_MIX[card.id] ?? 0;
    for (let i = 0; i < copies; i += 1) deck.push({ ...card, effect: { ...card.effect }, uid: `${card.id}-${i}` });
  }
  if (deck.length !== DECK_SIZE) throw new Error(`deck mix must total ${DECK_SIZE}, got ${deck.length}`);
  return shuffle(deck, random);
}

export function cardById(id) {
  return CATALOGUE.find((card) => card.id === id);
}
