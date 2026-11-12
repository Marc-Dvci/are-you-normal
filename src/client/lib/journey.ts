import { telemetry } from '@devvit/analytics/client/reddit';

/**
 * Devvit Journeys events for the daily loop. Telemetry never blocks or breaks
 * play, so every call is fire-and-forget.
 *
 * App.Ready      the screen is interactive
 * Journey.Start  first answer tapped
 * Progress       each reveal (1/3, 2/3, 3/3)
 * Interaction    guess locked, verdict posted, question proposed, source opened
 * Journey.End    the day card, with the score
 */
const quietly = (task: () => Promise<unknown>): void => {
  task().catch(() => undefined);
};

let started = false;

export const journey = {
  ready: () => quietly(() => telemetry.appReady()),
  start: () => {
    if (started || telemetry.getActiveJourneyId()) return;
    started = true;
    quietly(() => telemetry.startJourney());
  },
  progress: (done: number, total: number) =>
    quietly(() =>
      telemetry.progress({
        progress: Math.min(1, done / total),
        action: 'question_revealed',
        actionDetails: `q${done}`,
      })
    ),
  interaction: (action: string, actionDetails?: string) =>
    quietly(() =>
      telemetry.interaction(
        actionDetails ? { action, actionDetails } : { action }
      )
    ),
  end: (score: number, maxScore: number) =>
    quietly(async () => {
      await telemetry.endJourney({
        complete: true,
        game: { win: maxScore > 0 && score * 2 >= maxScore, score },
      });
      started = false;
    }),
};
