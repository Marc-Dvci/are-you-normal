export const CATEGORIES = [
  'food',
  'sleep',
  'home',
  'manners',
  'travel',
  'money',
  'work',
  'tech',
  'pets',
  'hygiene',
  'social',
  'leisure',
  'language',
  'culture',
  'holidays',
  'superstition',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Tier = 'weirdo' | 'rare' | 'odd' | 'normal' | 'boring';

export type QuestionKind = 'world' | 'community';

/** What the client may see before answering: no percentages. */
export type PublicQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  options: string[];
  category: Category;
  /** Plural noun for "out of 100 ___", e.g. "flyers". */
  crowd: string;
  /** Reddit username of the player who proposed a community question. */
  askedBy: string | null;
};

export type Source = {
  name: string;
  url: string;
  licence: string;
  /** Who was asked, e.g. "858 US adults surveyed online". */
  sample: string;
  year: number | null;
};

export type Reveal = {
  q: number;
  option: number;
  guess: number;
  /** Share, in percent, of the reference crowd that gave the player's answer. */
  truth: number;
  /** Null when the question cannot be scored yet (too few answers). */
  points: number | null;
  tier: Tier;
  line: string;
  world: { pcts: number[]; source: Source } | null;
  sub: { counts: number[]; n: number };
  contrast: string | null;
};

export type DaySummary = {
  edition: number;
  /** Mean share of people who answered like the player, in percent. */
  meanShare: number;
  tier: Tier;
  line: string;
  score: number;
  maxScore: number;
  rank: number | null;
  players: number;
  streak: number;
  bias: { mean: number; n: number } | null;
};

export type BoardRow = { username: string; score: number };

export type EditionInfo = {
  number: number;
  /** UTC date of the edition, YYYY-MM-DD. */
  date: string;
  questions: PublicQuestion[];
  players: number;
  /** ISO time of the next edition. */
  nextAt: string;
  isToday: boolean;
};

export type StateResponse = {
  type: 'state';
  edition: EditionInfo;
  me: {
    loggedIn: boolean;
    username: string | null;
    answers: (number | null)[];
    reveals: (Reveal | null)[];
    summary: DaySummary | null;
    streak: number;
  };
  board: BoardRow[];
};

export type AnswerRequest = { q: number; option: number };
export type AnswerResponse = { type: 'answer'; recorded: boolean };

export type GuessRequest = { q: number; guess: number; option: number };
export type GuessResponse = {
  type: 'guess';
  reveal: Reveal;
  summary: DaySummary | null;
  board: BoardRow[];
};

export type ProposalRequest = { question: string; options: string[] };
export type ProposalResponse = { type: 'proposal'; permalink: string | null };

export type CommentResponse = { type: 'comment'; permalink: string | null };

export type ErrorResponse = { type: 'error'; message: string };

export type LiveMessage = { q: number; counts: number[] };
