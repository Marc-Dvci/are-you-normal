import { describe, expect, it } from 'vitest';
import {
  checkProposal,
  hitsOffLimits,
  parseProposalMarkdown,
  proposalMarkdown,
} from '../../src/shared/proposal';

describe('checkProposal', () => {
  it('accepts an everyday question and tidies spaces', () => {
    expect(
      checkProposal('  Do you sleep   with socks on? ', ['Yes ', ' No', ''])
    ).toEqual({
      ok: true,
      question: 'Do you sleep with socks on?',
      options: ['Yes', 'No'],
    });
  });

  it.each([
    ['Socks?', ['Yes', 'No'], 'too short'],
    ['Do you sleep with socks on', ['Yes', 'No'], 'question mark'],
    ['Do you sleep with socks on?', ['Yes'], 'between 2 and 4'],
    [
      'Do you sleep with socks on?',
      ['A', 'B', 'C', 'D', 'E'],
      'between 2 and 4',
    ],
    ['Do you sleep with socks on?', ['Yes', 'yes'], 'different'],
    ['Do you sleep with socks on?', ['Yes', 'x'.repeat(29)], 'under 28'],
    [`Do you ${'really '.repeat(14)}sleep?`, ['Yes', 'No'], 'under 90'],
    ['Have you read r/socks today?', ['Yes', 'No'], 'No links'],
    ['Is https://socks.example good?', ['Yes', 'No'], 'No links'],
  ])('rejects %j', (question, options, reason) => {
    const result = checkProposal(question, options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });

  it.each([
    'How often do you pray before meals?',
    'Who did you vote for last time?',
    'Do you drink alcohol on weekdays?',
    'Have you ever had sex on a plane?',
    'Are you religious at all?',
  ])('keeps off-limits topics out: %s', (question) => {
    const result = checkProposal(question, ['Yes', 'No']);
    expect(result.ok).toBe(false);
  });

  it.each([
    'Do you use public transport?',
    'Which skills did you learn this year?',
    'Do you sleep in on Sundays?',
  ])('does not trip on innocent words: %s', (question) => {
    expect(hitsOffLimits(question)).toBe(false);
  });
});

describe('proposal comments', () => {
  it('round-trips through the comment text', () => {
    const body = proposalMarkdown(12, 'Do you sleep with socks on?', [
      'Always',
      'Never',
    ]);
    expect(body).toContain('**Proposal for No. 13:**');
    expect(parseProposalMarkdown(body)).toEqual({
      question: 'Do you sleep with socks on?',
      options: ['Always', 'Never'],
    });
  });

  it('rejects a comment edited into a forbidden topic', () => {
    const body = proposalMarkdown(12, 'Who will you vote for?', ['A', 'B']);
    expect(parseProposalMarkdown(body)).toBeNull();
  });

  it('ignores comments that are not proposals', () => {
    expect(parseProposalMarkdown('great game')).toBeNull();
  });
});
