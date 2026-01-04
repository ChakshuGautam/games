/**
 * Pangram Game React Component
 * Works directly with XState machine state
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { PangramContext, PangramEvent } from '../machine.js';
import { isPangram } from '../mechanics.js';

// ============================================================================
// Props Interface
// ============================================================================

export interface PangramGameProps {
  /** Current machine context */
  context: PangramContext;

  /** Current machine state value */
  stateValue: string;

  /** Send events to machine */
  send: (event: PangramEvent) => void;

  /** Custom class name */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface HexagonProps {
  letter: string;
  isCenter: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function Hexagon({ letter, isCenter, onClick, disabled }: HexagonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-16 h-16 flex items-center justify-center text-2xl font-bold
        transition-all duration-150 hover:scale-110 active:scale-95
        disabled:opacity-50 disabled:hover:scale-100
        ${isCenter
          ? 'bg-amber-400 text-amber-900 hover:bg-amber-300'
          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }
        rounded-xl shadow-md hover:shadow-lg
      `}
    >
      {letter}
    </button>
  );
}

interface WordListProps {
  words: string[];
  letters: string[];
}

function WordList({ words, letters }: WordListProps) {
  const pangrams = words.filter(w => isPangram(w, letters));

  return (
    <div className="bg-slate-800/50 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-slate-300">Found Words</h2>
        {pangrams.length > 0 && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
            {pangrams.length} pangram{pangrams.length > 1 ? 's' : ''}!
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
        {words.length === 0 ? (
          <span className="text-slate-500 text-sm">No words found yet</span>
        ) : (
          words.map(word => (
            <span
              key={word}
              className={`
                px-2 py-1 rounded text-sm
                ${isPangram(word, letters)
                  ? 'bg-amber-500/30 text-amber-300 font-bold'
                  : 'bg-slate-700 text-slate-300'
                }
              `}
            >
              {word}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PangramGame({
  context,
  stateValue,
  send,
  className = '',
}: PangramGameProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    letters,
    centerLetter,
    currentInput,
    foundWords,
    score,
    lastMessage,
    lastMessageType,
  } = context;

  const isValidating = stateValue === 'validating';
  const outerLetters = letters.filter(l => l !== centerLetter);
  const canAct = !isValidating;

  // Focus input on mount and when validation completes
  useEffect(() => {
    if (!isValidating) {
      inputRef.current?.focus();
    }
  }, [isValidating]);

  // Action handlers
  const addLetter = useCallback((letter: string) => {
    if (canAct) {
      send({ type: 'ADD_LETTER', letter });
    }
  }, [canAct, send]);

  const deleteLetter = useCallback(() => {
    if (canAct && currentInput.length > 0) {
      send({ type: 'DELETE_LETTER' });
    }
  }, [canAct, currentInput, send]);

  const submit = useCallback(() => {
    if (canAct && currentInput.length >= 4) {
      send({ type: 'SUBMIT' });
    }
  }, [canAct, currentInput, send]);

  const clear = useCallback(() => {
    if (canAct) {
      send({ type: 'CLEAR' });
    }
  }, [canAct, send]);

  const newPuzzle = useCallback(() => {
    send({ type: 'NEW_PUZZLE' });
  }, [send]);

  // Keyboard handling
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAct) {
      e.target.value = '';
      return;
    }

    const value = e.target.value.toUpperCase();
    const lastChar = value.slice(-1);

    if (lastChar && letters.includes(lastChar)) {
      addLetter(lastChar);
    }
    e.target.value = '';
  }, [canAct, letters, addLetter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!canAct) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      deleteLetter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clear();
    }
  }, [canAct, submit, deleteLetter, clear]);

  // Message styling
  const messageStyles = {
    info: 'bg-blue-500/20 text-blue-400',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
    pangram: 'bg-amber-500/20 text-amber-400 text-xl',
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input for keyboard capture */}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        aria-label="Type letters here"
        disabled={!canAct}
      />

      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Pangram
          </h1>
          <p className="text-slate-400 text-sm mt-1">Find words using these letters</p>
        </div>

        {/* Score */}
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="text-lg">
            <span className="text-slate-400">Score:</span>{' '}
            <span className="font-bold text-amber-400">{score}</span>
          </div>
          <div className="text-sm text-slate-400">
            {foundWords.length} words found
          </div>
        </div>

        {/* Current Word Input */}
        <div
          className={`
            bg-slate-800 rounded-xl p-4 mb-6 min-h-16 flex items-center justify-center cursor-text
            border-2 transition-colors
            ${isValidating ? 'border-amber-500' : 'border-slate-700'}
          `}
          onClick={() => inputRef.current?.focus()}
        >
          <span className="text-2xl font-mono tracking-wider">
            {currentInput || <span className="text-slate-500">Click here or start typing...</span>}
            {canAct && <span className="animate-pulse text-amber-400">|</span>}
          </span>
        </div>

        {/* Message */}
        {(lastMessage || isValidating) && (
          <div className={`
            text-center mb-4 py-2 px-4 rounded-lg font-semibold
            ${isValidating ? 'bg-blue-500/20 text-blue-400' : messageStyles[lastMessageType]}
          `}>
            {isValidating && <span className="inline-block animate-spin mr-2">*</span>}
            {isValidating ? 'Checking dictionary...' : lastMessage}
          </div>
        )}

        {/* Letter Honeycomb */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex gap-2">
            <Hexagon letter={outerLetters[0]} isCenter={false} onClick={() => addLetter(outerLetters[0])} disabled={!canAct} />
            <Hexagon letter={outerLetters[1]} isCenter={false} onClick={() => addLetter(outerLetters[1])} disabled={!canAct} />
          </div>
          <div className="flex gap-2">
            <Hexagon letter={outerLetters[2]} isCenter={false} onClick={() => addLetter(outerLetters[2])} disabled={!canAct} />
            <Hexagon letter={centerLetter} isCenter={true} onClick={() => addLetter(centerLetter)} disabled={!canAct} />
            <Hexagon letter={outerLetters[3]} isCenter={false} onClick={() => addLetter(outerLetters[3])} disabled={!canAct} />
          </div>
          <div className="flex gap-2">
            <Hexagon letter={outerLetters[4]} isCenter={false} onClick={() => addLetter(outerLetters[4])} disabled={!canAct} />
            <Hexagon letter={outerLetters[5]} isCenter={false} onClick={() => addLetter(outerLetters[5])} disabled={!canAct} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={deleteLetter}
            disabled={!canAct || currentInput.length === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={submit}
            disabled={!canAct || currentInput.length < 4}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-amber-900 font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {isValidating ? 'Checking...' : 'Enter'}
          </button>
        </div>

        {/* Found Words */}
        <div className="mb-4">
          <WordList words={foundWords} letters={letters} />
        </div>

        {/* Controls */}
        <div className="flex justify-end">
          <button
            onClick={newPuzzle}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            New Puzzle
          </button>
        </div>

        {/* Rules */}
        <div className="mt-6 text-xs text-slate-500 text-center space-y-1">
          <p>Words must be 4+ letters and include the center letter</p>
          <p>Letters can be reused - Pangrams use all 7 letters (+7 bonus!)</p>
        </div>
      </div>
    </div>
  );
}

export default PangramGame;
