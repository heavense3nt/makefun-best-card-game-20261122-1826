// Seeded randomness for Ember Clash. The live game seeds from the clock, but the
// screenshot scenes seed from a fixed number, so the same seed always deals the
// same hands and the screenshots are reproducible frame for frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle driven by the given random function; returns the array. */
export function shuffle(deck, random) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Pick one element of an array with the given random function. */
export function pickOne(list, random) {
  return list[Math.floor(random() * list.length)];
}
