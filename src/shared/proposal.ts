export const QUESTION_MIN = 12;
export const QUESTION_MAX = 90;
export const OPTION_MAX = 28;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 4;

/**
 * Topics the game stays away from. Devvit rules forbid inferring health,
 * sex life, religion, politics or sexual orientation from what players do.
 */
/** A trailing `*` matches any ending: `religio*` also catches "religious". */
const OFF_LIMITS = [
  'sex*',
  'porn*',
  'nude*',
  'naked',
  'religio*',
  'church*',
  'mosque*',
  'synagogue*',
  'pray*',
  'god',
  'gods',
  'bible*',
  'quran',
  'vote*',
  'voting',
  'election*',
  'trump',
  'biden',
  'democrat*',
  'republican*',
  'abortion*',
  'gay',
  'lesbian*',
  'trans',
  'transgender*',
  'drug*',
  'weed',
  'cocaine',
  'alcohol*',
  'drunk*',
  'suicid*',
  'depress*',
  'diagnos*',
  'disease*',
  'cancer*',
  'kill*',
];

const OFF_LIMITS_RE = OFF_LIMITS.map((entry) =>
  entry.endsWith('*')
    ? new RegExp(`\\b${entry.slice(0, -1)}`, 'i')
    : new RegExp(`\\b${entry}\\b`, 'i')
);

const LINK = /(https?:\/\/|www\.|\.com\b|\br\/\w|\bu\/\w)/i;

export type ProposalCheck =
  | { ok: true; question: string; options: string[] }
  | { ok: false; reason: string };

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const hitsOffLimits = (text: string): boolean =>
  OFF_LIMITS_RE.some((re) => re.test(text));

export const checkProposal = (
  rawQuestion: string,
  rawOptions: readonly string[]
): ProposalCheck => {
  const question = tidy(rawQuestion);
  const options = rawOptions.map(tidy).filter((o) => o.length > 0);
  if (question.length < QUESTION_MIN)
    return { ok: false, reason: 'The question is too short.' };
  if (question.length > QUESTION_MAX)
    return {
      ok: false,
      reason: `Keep the question under ${QUESTION_MAX} characters.`,
    };
  if (!question.endsWith('?'))
    return { ok: false, reason: 'End the question with a question mark.' };
  if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX)
    return { ok: false, reason: 'Give between 2 and 4 answers.' };
  if (options.some((o) => o.length > OPTION_MAX))
    return {
      ok: false,
      reason: `Keep each answer under ${OPTION_MAX} characters.`,
    };
  const lowered = options.map((o) => o.toLowerCase());
  if (new Set(lowered).size !== lowered.length)
    return { ok: false, reason: 'Each answer must be different.' };
  const all = [question, ...options];
  if (all.some((t) => LINK.test(t)))
    return { ok: false, reason: 'No links or usernames, please.' };
  if (all.some(hitsOffLimits))
    return {
      ok: false,
      reason:
        'This game stays clear of health, sex, religion, politics and drugs.',
    };
  return { ok: true, question, options };
};

export const proposalMarkdown = (
  edition: number,
  question: string,
  options: readonly string[]
): string =>
  [
    `**Proposal for No. ${edition + 1}:** ${question}`,
    '',
    ...options.map((o, i) => `${i + 1}. ${o}`),
    '',
    '^(The most upvoted proposal becomes tomorrow’s community question.)',
  ].join('\n');

/** Reads a proposal back from the comment text it was posted as. */
export const parseProposalMarkdown = (
  body: string
): { question: string; options: string[] } | null => {
  const head = /\*\*Proposal for No\. \d+:\*\*\s*(.+)/.exec(body);
  if (!head?.[1]) return null;
  const options = [...body.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) =>
    (m[1] ?? '').trim()
  );
  const checked = checkProposal(head[1], options);
  return checked.ok
    ? { question: checked.question, options: checked.options }
    : null;
};
