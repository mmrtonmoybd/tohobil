export type PositiveMoment =
  | 'goal_reached'
  | 'debt_settled'
  | 'budget_achieved';

export interface ReviewState {
  installedAt: number;
  positiveMoments: number;
  lastPromptedAt: number | null;
  hasRated: boolean;
}

const REVIEW_STATE_KEY = 'tohobil.review_state';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function loadReviewState(): ReviewState {
  try {
    const raw = localStorage.getItem(REVIEW_STATE_KEY);
    if (!raw) {
      const initial: ReviewState = {
        installedAt: Date.now(),
        positiveMoments: 0,
        lastPromptedAt: null,
        hasRated: false,
      };
      localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return {
      installedAt: Date.now(),
      positiveMoments: 0,
      lastPromptedAt: null,
      hasRated: false,
    };
  }
}

function saveReviewState(state: ReviewState): void {
  try {
    localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage issues
  }
}

export function getReviewState(): ReviewState {
  return loadReviewState();
}

/**
 * Records a positive moment (e.g. goal reached, debt settled).
 * Returns true if the user should be prompted for review now.
 * SPEC: "never in the first week, after positive moments".
 */
export function recordPositiveMoment(
  moment: PositiveMoment,
  now = Date.now(),
): boolean {
  void moment;
  const state = loadReviewState();

  // If already rated, don't ask again
  if (state.hasRated) return false;

  // Never prompt in the first 7 days
  if (now - state.installedAt < SEVEN_DAYS_MS) {
    state.positiveMoments += 1;
    saveReviewState(state);
    return false;
  }

  // If prompted within the last 60 days, don't ask again
  if (state.lastPromptedAt && now - state.lastPromptedAt < SIXTY_DAYS_MS) {
    state.positiveMoments += 1;
    saveReviewState(state);
    return false;
  }

  state.positiveMoments += 1;

  // Trigger prompt if 2 or more positive moments have occurred after the first week
  if (state.positiveMoments >= 2) {
    state.lastPromptedAt = now;
    saveReviewState(state);
    return true;
  }

  saveReviewState(state);
  return false;
}

export function handleReviewPromptResponse(
  action: 'rated' | 'dismissed' | 'feedback',
): void {
  const state = loadReviewState();
  if (action === 'rated') {
    state.hasRated = true;
  }
  state.lastPromptedAt = Date.now();
  saveReviewState(state);
}

export function resetReviewStateForTesting(): void {
  localStorage.removeItem(REVIEW_STATE_KEY);
}
