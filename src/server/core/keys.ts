/** Every Redis key the app writes, in one place. */
export const K = {
  epoch: 'meta:epoch',
  cursor: 'meta:cursor',
  lock: (n: number) => `lock:ed:${n}`,
  editionPost: (n: number) => `ed:${n}:post`,
  postEdition: (postId: string) => `post:${postId}`,
  editionQuestions: (n: number) => `ed:${n}:qs`,
  votes: (n: number, q: number) => `ed:${n}:q${q}:votes`,
  voters: (n: number, q: number) => `ed:${n}:q${q}:who`,
  players: (n: number) => `ed:${n}:players`,
  scores: (n: number) => `ed:${n}:scores`,
  names: (n: number) => `ed:${n}:names`,
  sticky: (n: number) => `ed:${n}:sticky`,
  proposals: (n: number) => `ed:${n}:proposals`,
  proposalCount: (n: number) => `ed:${n}:proposal-count`,
  proposers: (n: number) => `ed:${n}:proposers`,
  verdictComments: (n: number) => `ed:${n}:verdict-comments`,
  closed: (n: number) => `ed:${n}:closed`,
  userDay: (userId: string, n: number) => `u:${userId}:ed:${n}`,
  userStats: (userId: string) => `u:${userId}:stats`,
  live: (n: number, q: number) => `live:${n}:${q}`,
} as const;

/** Per-user day records expire after this many seconds. */
export const USER_DAY_TTL = 35 * 86_400;

export const liveChannel = (n: number): string => `ed${n}`;
