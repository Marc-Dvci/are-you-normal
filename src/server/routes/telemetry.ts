import { telemetry } from '@devvit/analytics/server/reddit';
import { Hono, type Context } from 'hono';

/**
 * Hono version of the routes that `@devvit/analytics` ships for Express.
 * The browser client in `@devvit/analytics/client/reddit` posts here.
 */
export const telemetryRoutes = new Hono();

const invalid = {
  status: 'JOURNEY_RECEIPT_INVALID',
  message: 'Invalid: Event payload was not recorded.',
};

type Body = Record<string, unknown>;

const readBody = async (c: Context): Promise<Body | null> => {
  try {
    const body: unknown = await c.req.json();
    return typeof body === 'object' && body !== null ? (body as Body) : null;
  } catch {
    return null;
  }
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const guarded =
  (handler: (c: Context) => Promise<Response>) =>
  async (c: Context): Promise<Response> => {
    try {
      return await handler(c);
    } catch (error) {
      console.error('Telemetry route failed', error);
      return c.json({ error: 'Telemetry failed', receipt: invalid }, 500);
    }
  };

telemetryRoutes.post(
  '/journey/start',
  guarded(async (c) => c.json(await telemetry.startJourney()))
);

telemetryRoutes.post(
  '/journey/app-ready',
  guarded(async (c) => c.json(await telemetry.appReady()))
);

telemetryRoutes.post(
  '/journey/progress',
  guarded(async (c) => {
    const body = await readBody(c);
    const journeyId = text(body?.['journeyId']);
    const progress = body?.['progress'];
    if (
      !journeyId ||
      typeof progress !== 'number' ||
      progress < 0 ||
      progress > 1
    ) {
      return c.json({ error: 'Bad progress event', receipt: invalid }, 400);
    }
    return c.json(
      await telemetry.journeyProgress({
        journeyId,
        progress,
        action: text(body?.['action']) ?? '',
        actionDetails: text(body?.['actionDetails']) ?? '',
      })
    );
  })
);

telemetryRoutes.post(
  '/journey/interaction',
  guarded(async (c) => {
    const body = await readBody(c);
    const action = text(body?.['action']);
    if (!action) {
      return c.json({ error: 'Bad interaction event', receipt: invalid }, 400);
    }
    return c.json(
      await telemetry.journeyInteraction({
        journeyId: text(body?.['journeyId']) ?? '',
        action,
        actionDetails: text(body?.['actionDetails']) ?? '',
      })
    );
  })
);

telemetryRoutes.post(
  '/journey/end',
  guarded(async (c) => {
    const body = await readBody(c);
    const journeyId = text(body?.['journeyId']);
    if (!journeyId) {
      return c.json({ error: 'Bad end event', receipt: invalid }, 400);
    }
    const game = body?.['game'];
    const gameBody =
      typeof game === 'object' && game !== null ? (game as Body) : null;
    return c.json(
      await telemetry.endJourney({
        journeyId,
        complete: body?.['complete'] === true,
        ...(gameBody
          ? {
              game: {
                win: gameBody['win'] === true,
                score:
                  typeof gameBody['score'] === 'number' ? gameBody['score'] : 0,
              },
            }
          : {}),
      })
    );
  })
);
