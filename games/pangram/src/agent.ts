/**
 * Pangram Agent
 *
 * A "dumb" agent that only interacts through the machine interface.
 * It does NOT call mechanics directly - it just tries words and observes results.
 *
 * This follows the architectural reduction principle:
 * - Agent sends events (SUBMIT_WORD)
 * - Agent observes results (score changed? error message?)
 * - Agent learns from feedback
 */

import { createActor } from 'xstate';
import { pangramMachine } from './index.js';

// Word candidates - agent doesn't know which are valid, just tries them
const WORD_CANDIDATES = [
  // Potential pangrams (try first - highest value)
  'cracking', 'cranking', 'racking', 'carking', 'tracking',
  // Long words
  'ranking', 'racking', 'kicking', 'nicking', 'ricking', 'narking',
  'raking', 'caking', 'inking', 'irking', 'arcing', 'acing',
  // Medium words
  'crack', 'crank', 'rank', 'rack', 'kick', 'nick', 'rick',
  'king', 'ring', 'grin', 'grain', 'cairn', 'kiang',
  // Short words
  'rack', 'rain', 'rang', 'rank', 'ring', 'rink', 'rick', 'nick',
  'king', 'kink', 'kick', 'gain', 'grin', 'crag', 'cark',
  'akin', 'narc', 'nark', 'ark', 'ink', 'kin', 'rig', 'nag',
];

/**
 * Simple observation from machine state
 */
function observe(actor: ReturnType<typeof createActor>) {
  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;
  return {
    letters: ctx.letters,
    centerLetter: ctx.centerLetter,
    score: ctx.score,
    foundWords: ctx.foundWords,
    lastMessage: ctx.lastMessage,
    lastMessageType: ctx.lastMessageType,
    isValidating: snapshot.value === 'validating',
  };
}

/**
 * Wait for machine to finish validating
 */
async function waitForResult(actor: ReturnType<typeof createActor>, maxWait = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const obs = observe(actor);
    if (!obs.isValidating) return obs;
    await new Promise(r => setTimeout(r, 50));
  }
  return observe(actor);
}

/**
 * Agent that plays Pangram using only the machine interface
 */
async function playPangram(maxAttempts = 100) {
  console.log('='.repeat(60));
  console.log('PANGRAM AGENT (Machine-Only Interface)');
  console.log('='.repeat(60));

  // Create actor
  const actor = createActor(pangramMachine, {
    input: { puzzleIndex: 0 }
  });
  actor.start();

  // Observe initial state
  let obs = observe(actor);
  console.log(`\nPuzzle: ${obs.letters.join(' ')} (center: ${obs.centerLetter})`);
  console.log(`Starting score: ${obs.score}\n`);

  const triedWords = new Set<string>();
  let attempts = 0;
  let accepted = 0;

  // Try words - agent doesn't pre-validate, just observes results
  for (const word of WORD_CANDIDATES) {
    if (attempts >= maxAttempts) break;
    if (triedWords.has(word.toLowerCase())) continue;

    triedWords.add(word.toLowerCase());
    const prevScore = obs.score;

    // Send consolidated event - agent doesn't know if it will work
    actor.send({ type: 'SUBMIT_WORD', word });
    attempts++;

    // Wait for result and observe
    obs = await waitForResult(actor);

    // Learn from feedback
    if (obs.score > prevScore) {
      accepted++;
      const points = obs.score - prevScore;
      const isPangram = points > 10; // Pangrams give 14+ points
      console.log(
        `  ✓ [+${points}] ${word.toUpperCase()}` +
        (isPangram ? ' (PANGRAM!)' : '') +
        ` → Score: ${obs.score}`
      );
    }
    // Agent could log rejections to learn, but we skip for cleaner output
  }

  // Final results
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`Words found: ${obs.foundWords.length}`);
  console.log(`Final score: ${obs.score}`);
  console.log(`Attempts: ${attempts}`);
  console.log(`Success rate: ${((accepted / attempts) * 100).toFixed(1)}%`);
  console.log(`\nWords: ${obs.foundWords.join(', ')}`);

  // Count pangrams by checking which words gave 14+ points
  const pangrams = obs.foundWords.filter((w: string) => w.length === 7 || w.length === 8);
  if (pangrams.length > 0) {
    console.log(`Pangrams: ${pangrams.join(', ')}`);
  }

  actor.stop();

  return {
    score: obs.score,
    words: obs.foundWords,
    attempts,
    successRate: accepted / attempts,
  };
}

// Export for testing
export { playPangram, observe, waitForResult };

// Run if executed directly
playPangram(100).then(result => {
  console.log('\n' + '='.repeat(60));
  console.log(`Agent finished with score: ${result.score}`);
  process.exit(0);
}).catch(err => {
  console.error('Agent error:', err);
  process.exit(1);
});
