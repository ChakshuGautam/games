/**
 * Observation and Action Space definitions
 * Follows OpenAI Gym conventions for space types
 */

// ============================================================================
// Space Types
// ============================================================================

export type Space =
  | DiscreteSpace
  | BoxSpace
  | MultiBinarySpace
  | MultiDiscreteSpace
  | TextSpace
  | DictSpace
  | TupleSpace
  | SequenceSpace;

/**
 * Discrete space with n possible values (0 to n-1)
 */
export interface DiscreteSpace {
  type: 'discrete';
  /** Number of possible values */
  n: number;
  /** Optional human-readable labels for each value */
  labels?: string[];
}

/**
 * Box space - continuous or discrete values within bounds
 */
export interface BoxSpace {
  type: 'box';
  /** Shape of the space */
  shape: number[];
  /** Lower bound(s) */
  low: number | number[];
  /** Upper bound(s) */
  high: number | number[];
  /** Data type */
  dtype: 'int' | 'float';
}

/**
 * Space of binary vectors
 */
export interface MultiBinarySpace {
  type: 'multibinary';
  /** Number of binary elements */
  n: number;
}

/**
 * Space of integer vectors where each element has its own bound
 */
export interface MultiDiscreteSpace {
  type: 'multidiscrete';
  /** Upper bound for each dimension (exclusive) */
  nvec: number[];
}

/**
 * Text/string space with optional constraints
 */
export interface TextSpace {
  type: 'text';
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Allowed character pattern (regex) */
  charset?: string;
}

/**
 * Dictionary of named spaces
 */
export interface DictSpace {
  type: 'dict';
  /** Named sub-spaces */
  spaces: Record<string, Space>;
}

/**
 * Fixed-length tuple of spaces
 */
export interface TupleSpace {
  type: 'tuple';
  /** Ordered sub-spaces */
  spaces: Space[];
}

/**
 * Variable-length sequence of a single space type
 */
export interface SequenceSpace {
  type: 'sequence';
  /** Element type */
  space: Space;
  /** Minimum sequence length */
  minLength?: number;
  /** Maximum sequence length */
  maxLength?: number;
}

// ============================================================================
// Space Utilities
// ============================================================================

/**
 * Check if a value is valid for a given space
 */
export function validateValue(space: Space, value: unknown): boolean {
  switch (space.type) {
    case 'discrete':
      return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < space.n;

    case 'box': {
      if (!Array.isArray(value)) return false;
      const low = Array.isArray(space.low) ? space.low : Array(value.length).fill(space.low);
      const high = Array.isArray(space.high) ? space.high : Array(value.length).fill(space.high);
      return value.every((v, i) => typeof v === 'number' && v >= low[i] && v <= high[i]);
    }

    case 'multibinary':
      return Array.isArray(value) && value.length === space.n && value.every(v => v === 0 || v === 1);

    case 'multidiscrete':
      return (
        Array.isArray(value) &&
        value.length === space.nvec.length &&
        value.every((v, i) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < space.nvec[i])
      );

    case 'text': {
      if (typeof value !== 'string') return false;
      if (space.minLength !== undefined && value.length < space.minLength) return false;
      if (space.maxLength !== undefined && value.length > space.maxLength) return false;
      if (space.charset !== undefined && !new RegExp(`^${space.charset}*$`).test(value)) return false;
      return true;
    }

    case 'dict': {
      if (typeof value !== 'object' || value === null) return false;
      const obj = value as Record<string, unknown>;
      return Object.entries(space.spaces).every(([key, subSpace]) => validateValue(subSpace, obj[key]));
    }

    case 'tuple': {
      if (!Array.isArray(value) || value.length !== space.spaces.length) return false;
      return space.spaces.every((subSpace, i) => validateValue(subSpace, value[i]));
    }

    case 'sequence': {
      if (!Array.isArray(value)) return false;
      if (space.minLength !== undefined && value.length < space.minLength) return false;
      if (space.maxLength !== undefined && value.length > space.maxLength) return false;
      return value.every(v => validateValue(space.space, v));
    }

    default:
      return false;
  }
}

/**
 * Sample a random value from a space
 */
export function sampleSpace(space: Space): unknown {
  switch (space.type) {
    case 'discrete':
      return Math.floor(Math.random() * space.n);

    case 'box': {
      const flatSize = space.shape.reduce((a, b) => a * b, 1);
      const low = Array.isArray(space.low) ? space.low : Array(flatSize).fill(space.low);
      const high = Array.isArray(space.high) ? space.high : Array(flatSize).fill(space.high);
      return low.map((l, i) => {
        const val = l + Math.random() * (high[i] - l);
        return space.dtype === 'int' ? Math.floor(val) : val;
      });
    }

    case 'multibinary':
      return Array.from({ length: space.n }, () => Math.random() < 0.5 ? 0 : 1);

    case 'multidiscrete':
      return space.nvec.map(n => Math.floor(Math.random() * n));

    case 'text': {
      const charset = space.charset || '[a-z]';
      const minLen = space.minLength || 0;
      const maxLen = space.maxLength || 10;
      const len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
      // Simplified - just return lowercase letters
      return Array.from({ length: len }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26))
      ).join('');
    }

    case 'dict':
      return Object.fromEntries(
        Object.entries(space.spaces).map(([key, subSpace]) => [key, sampleSpace(subSpace)])
      );

    case 'tuple':
      return space.spaces.map(subSpace => sampleSpace(subSpace));

    case 'sequence': {
      const minLen = space.minLength || 0;
      const maxLen = space.maxLength || 5;
      const len = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
      return Array.from({ length: len }, () => sampleSpace(space.space));
    }

    default:
      throw new Error(`Unknown space type`);
  }
}

/**
 * Get the flat size of a space (for vectorization)
 */
export function getSpaceSize(space: Space): number | null {
  switch (space.type) {
    case 'discrete':
      return 1;

    case 'box':
      return space.shape.reduce((a, b) => a * b, 1);

    case 'multibinary':
      return space.n;

    case 'multidiscrete':
      return space.nvec.length;

    case 'text':
      return null; // Variable size

    case 'dict': {
      const sizes = Object.values(space.spaces).map(getSpaceSize);
      if (sizes.some(s => s === null)) return null;
      return sizes.reduce((a, b) => a! + b!, 0);
    }

    case 'tuple': {
      const sizes = space.spaces.map(getSpaceSize);
      if (sizes.some(s => s === null)) return null;
      return sizes.reduce((a, b) => a! + b!, 0);
    }

    case 'sequence':
      return null; // Variable size

    default:
      return null;
  }
}
