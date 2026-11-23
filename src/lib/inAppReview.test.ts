import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordPositiveMoment,
  handleReviewPromptResponse,
  resetReviewStateForTesting,
} from './inAppReview';

describe('inAppReview', () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const BASE_TIME = 1795370000000;

  beforeEach(() => {
    localStorage.clear();
    resetReviewStateForTesting();
  });

  it('never prompts in the first week (7 days)', () => {
    // Recorded on day 1
    const p1 = recordPositiveMoment('goal_reached', BASE_TIME);
    expect(p1).toBe(false);

    // Recorded on day 3
    const p2 = recordPositiveMoment('debt_settled', BASE_TIME + 3 * ONE_DAY);
    expect(p2).toBe(false);

    // Recorded on day 6
    const p3 = recordPositiveMoment('budget_achieved', BASE_TIME + 6 * ONE_DAY);
    expect(p3).toBe(false);
  });

  it('prompts after the first week once positive moment threshold is met', () => {
    // Initialize on day 0
    recordPositiveMoment('goal_reached', BASE_TIME);

    // On day 8 (more than 7 days), trigger 2nd positive moment
    const shouldPrompt = recordPositiveMoment('debt_settled', BASE_TIME + 8 * ONE_DAY);
    expect(shouldPrompt).toBe(true);

    // If dismissed, doesn't prompt immediately again on day 9
    handleReviewPromptResponse('dismissed');
    const nextDayPrompt = recordPositiveMoment('budget_achieved', BASE_TIME + 9 * ONE_DAY);
    expect(nextDayPrompt).toBe(false);
  });

  it('never prompts again once user has rated', () => {
    recordPositiveMoment('goal_reached', BASE_TIME);
    handleReviewPromptResponse('rated');

    const shouldPrompt = recordPositiveMoment('goal_reached', BASE_TIME + 30 * ONE_DAY);
    expect(shouldPrompt).toBe(false);
  });
});
