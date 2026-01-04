/**
 * Pangram Agent
 *
 * Uses the same XState interface as the UI to play the game.
 * Demonstrates that agents and humans share the same API.
 */

import { createActor } from 'xstate';
import { pangramMachine, validateWordDictionary, validateWordRules, isPangram, calculateWordScore } from './index.js';

// Common English words to try (filtered by puzzle letters at runtime)
const COMMON_WORDS = [
  // 4-letter words
  'rack', 'rain', 'rang', 'rank', 'ring', 'rink', 'rick', 'nick', 'nark',
  'king', 'kink', 'kick', 'gain', 'grin', 'gnar', 'crag', 'cark', 'cairn',
  'air', 'ark', 'can', 'car', 'gin', 'ink', 'kin', 'nag', 'rag', 'ran', 'rig',
  // 5-letter words
  'grain', 'grail', 'grank', 'crank', 'crack', 'crink', 'drink',
  'caring', 'racing', 'raking', 'ranking', 'racking', 'ricking',
  'acing', 'arcing', 'inking',
  // 6-letter words
  'racing', 'raking', 'ricing', 'acking', 'caring', 'caking',
  'racking', 'ranking', 'rinking', 'kicking', 'nicking', 'ricking',
  // 7-letter words (potential pangrams)
  'racking', 'cracking', 'tracking', 'carking', 'acking', 'ranking',
  'cranking', 'crankig', 'rackign',
  // More words with K
  'arak', 'akin', 'ankh', 'naik', 'kaing', 'kiang', 'naric', 'cairn',
  'ackin', 'arking', 'inking', 'irking', 'narking', 'parking', 'karning',
];

/**
 * Generate all permutations of letters up to a given length
 */
function generateCandidates(letters: string[], minLen: number, maxLen: number): string[] {
  const candidates: Set<string> = new Set();
  const letterLower = letters.map(l => l.toLowerCase());

  function permute(current: string, depth: number) {
    if (current.length >= minLen) {
      candidates.add(current);
    }
    if (depth >= maxLen) return;

    for (const letter of letterLower) {
      permute(current + letter, depth + 1);
    }
  }

  permute('', 0);
  return Array.from(candidates);
}

/**
 * Filter candidates to those that pass basic rules
 */
function filterByRules(
  candidates: string[],
  letters: string[],
  centerLetter: string,
  foundWords: string[]
): string[] {
  return candidates.filter(word => {
    const result = validateWordRules(word, letters, centerLetter, foundWords);
    return result.valid;
  });
}

/**
 * Agent that plays Pangram
 */
async function playPangram(maxAttempts: number = 50) {
  console.log('='.repeat(60));
  console.log('PANGRAM AGENT');
  console.log('='.repeat(60));

  // Create actor - same as UI does
  const actor = createActor(pangramMachine, {
    input: { puzzleIndex: 0 }
  });
  actor.start();

  const context = actor.getSnapshot().context;
  console.log(`\nPuzzle: ${context.letters.join(' ')} (center: ${context.centerLetter})`);
  console.log(`Starting score: ${context.score}`);
  console.log('');

  // Strategy: combine known words with generated permutations
  const shortCandidates = generateCandidates(context.letters, 4, 5);
  const allCandidates = [...new Set([...COMMON_WORDS, ...shortCandidates])];

  console.log(`Generated ${allCandidates.length} candidate words to try\n`);

  let attempts = 0;
  let validatedWords = 0;
  const testedWords = new Set<string>();

  // Sort candidates: prioritize longer words (more points) and potential pangrams
  const sortedCandidates = allCandidates
    .filter(w => w.length >= 4)
    .sort((a, b) => {
      // Prioritize pangrams
      const aIsPangram = isPangram(a, context.letters);
      const bIsPangram = isPangram(b, context.letters);
      if (aIsPangram && !bIsPangram) return -1;
      if (!aIsPangram && bIsPangram) return 1;
      // Then by length (longer = more points)
      return b.length - a.length;
    });

  for (const word of sortedCandidates) {
    if (attempts >= maxAttempts) break;
    if (testedWords.has(word.toLowerCase())) continue;

    testedWords.add(word.toLowerCase());
    const currentContext = actor.getSnapshot().context;

    // Check basic rules first (fast, no API call)
    const rulesResult = validateWordRules(
      word,
      currentContext.letters,
      currentContext.centerLetter,
      currentContext.foundWords
    );

    if (!rulesResult.valid) continue;

    // Validate against dictionary API
    attempts++;
    const isValid = await validateWordDictionary(word);

    if (isValid) {
      validatedWords++;
      const potentialScore = calculateWordScore(word, currentContext.letters);
      const isPangramWord = isPangram(word, currentContext.letters);

      // Type the word letter by letter (same as human would)
      for (const letter of word.toUpperCase()) {
        actor.send({ type: 'ADD_LETTER', letter });
      }

      // Submit
      actor.send({ type: 'SUBMIT' });

      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const newContext = actor.getSnapshot().context;
      const wasAccepted = newContext.foundWords.includes(word.toLowerCase());

      if (wasAccepted) {
        console.log(
          `  [+${potentialScore}] ${word.toUpperCase()}` +
          (isPangramWord ? ' (PANGRAM!)' : '') +
          ` -> Score: ${newContext.score}`
        );
      }
    }

    // Small delay to not hammer the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Final results
  const finalContext = actor.getSnapshot().context;
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`Words found: ${finalContext.foundWords.length}`);
  console.log(`Final score: ${finalContext.score}`);
  console.log(`API calls made: ${attempts}`);
  console.log(`Valid words discovered: ${validatedWords}`);
  console.log(`\nWords: ${finalContext.foundWords.join(', ')}`);

  const pangrams = finalContext.foundWords.filter(w =>
    isPangram(w, finalContext.letters)
  );
  if (pangrams.length > 0) {
    console.log(`Pangrams: ${pangrams.join(', ')}`);
  }

  actor.stop();

  return {
    score: finalContext.score,
    words: finalContext.foundWords,
    pangrams,
  };
}

// Run the agent
playPangram(100).then(result => {
  console.log('\n' + '='.repeat(60));
  console.log(`Agent finished with score: ${result.score}`);
  process.exit(0);
}).catch(err => {
  console.error('Agent error:', err);
  process.exit(1);
});
