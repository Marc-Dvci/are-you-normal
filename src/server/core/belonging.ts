import { context, reddit } from '@devvit/web/server';
import { STAMP_WORD } from '../../shared/scoring';
import { getState, PlayError, type Player } from './play';

/** The flair a player chooses to wear: today's stamp and their streak. */
export const flairText = (stamp: string, streak: number): string =>
  streak > 1 ? `${stamp} · ${streak}-day streak` : stamp;

/** Sets the player's flair to today's stamp, only when they ask for it. */
export const wearStamp = async (
  n: number,
  player: NonNullable<Player>,
  now: Date
): Promise<string> => {
  const state = await getState(n, player, now);
  const summary = state.me.summary;
  if (!summary) throw new PlayError('Finish today’s questions first.', 409);
  const text = flairText(STAMP_WORD[summary.tier], summary.streak);
  await reddit.setUserFlair({
    subredditName: context.subredditName,
    username: player.username,
    text,
    backgroundColor: '#121212',
    textColor: 'light',
  });
  return text;
};

/** Joins the subreddit for the player, at their request. */
export const joinSubreddit = async (): Promise<void> => {
  await reddit.subscribeToCurrentSubreddit();
};
