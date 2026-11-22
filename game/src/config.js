// Ember Clash — tuning constants. One place holds every number the rules use,
// so balancing the game means editing this file and nothing else.
export const START_HP = 30;
export const HAND_LIMIT = 7;
export const DECK_SIZE = 30;
export const OPENING_HAND = 4;
export const MAX_ENERGY = 10;
export const SHIELD_DECAY = 2; // shield halves (rounded down) at the start of its owner's turn
export const BURN_TICKS = 2; // burn lasts this many turn-starts

// How long the AI pauses between its moves, in milliseconds, so its plays read
// as a thinking opponent instead of an instant blur.
export const AI_THINK_MS = 650;
export const AI_PLAY_MS = 520;

// Animation timings for card flight and damage numbers.
export const CARD_FLY_MS = 420;
export const DAMAGE_POP_MS = 700;
