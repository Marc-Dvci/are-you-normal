# Are You Normal?

**A daily Reddit game that puts you, your subreddit and a real published survey on the same chart.**

Every day a new post asks three everyday questions. You answer for yourself, guess how many people in 100 answered the same way, and then see the real share from a cited survey next to the live share of players in the subreddit. A stamp gives the verdict: under 5% is a weirdo, over 70% is boring.

| | |
|---|---|
| Platform | Reddit Developer Platform (Devvit Web), interactive posts |
| Event | Reddit's Game of the Day Hackathon, 2026 |
| Built with | TypeScript, React 19, Hono, Devvit Redis, realtime, scheduler and Journeys |
| Question bank | 49 questions from FiveThirtyEight, Eurostat, the US Bureau of Labor Statistics, the UK Office for National Statistics and Pew Research Center |
| Tests | 171 passing, 95% of server and shared lines covered |

## How to play

1. **Answer.** The first question sits in the feed. Tap your honest answer and the game opens.
2. **Guess.** A crowd of 100 figures appears. Tap how many of them you think answered like you. Arrows and the plus and minus buttons fine-tune it.
3. **Reveal.** The real figures fill in from the survey, with your guess marked in red. You score 100 points for an exact guess and lose 2 points for every point you are off.
4. **Compare.** Two rows show the survey and this subreddit side by side. Once ten players have answered, one line names where the subreddit differs most from the survey.
5. **Your day.** After three questions you get a stamp for the day, your score out of 300, your rank, your streak and, after a few days, how far you over- or under-estimate how common you are.

Then you can post your verdict as a reply in the day's results thread, or propose tomorrow's question.

## What makes it a daily game

- **A new edition every day.** Editions change at midnight UTC. A scheduled job posts each one, and the first player to open any post after midnight posts it if the job has not. Each edition freezes its questions when it is made, so older posts stay playable.
- **Streaks.** Finishing an edition on its own day extends your streak. Catching up on an old one counts as played but does not extend it.
- **The subreddit writes the third question.** At the end of the game, players propose a question with two to four answers. It is posted as their own comment. The most upvoted proposal with at least one upvote besides the author's runs the next day as the community question, credited to its author, and answered only by players here.
- **The count is closed every night.** When a new edition is posted, the app writes the final count for yesterday's edition as a comment on its post: the subreddit's split, the survey's split, and the biggest difference between them.

## Why the guess is scored and the answer is not

The game never scores your answer. If being normal earned points, people would pick the common answer and the subreddit's numbers would stop meaning anything. You score on the guess instead. People tend to think their own habits are more common than they are, an effect psychologists call the false consensus effect (Ross, Greene and House, 1977). The day card measures it for you: "You think 12 more people in 100 are like you than really are."

## Where the numbers come from

Each question cites its source, its sample and its licence on the reveal screen. The percentages are published survey results, never estimates.

| Source | Licence | Questions | How the figures are checked |
|---|---|---:|---|
| FiveThirtyEight survey data | CC BY 4.0 | 35 | Recomputed from the raw survey files in `content/fivethirtyeight/` on every test run |
| US Bureau of Labor Statistics, American Time Use Survey 2025 | Public domain | 7 | Read from Table 1 |
| Eurostat and the European Commission | CC BY 4.0 | 4 | Read from the named Eurostat tables and the Eurobarometer release |
| UK Office for National Statistics, Census 2021 | Open Government Licence v3.0 | 1 | Summed from table TS061 |
| Pew Research Center | Quoted with attribution | 2 | Read from the cited report |

Survey questions stay on everyday habits, manners and tastes. The game keeps away from health, sex, religion, politics and drugs, in its own questions and in player proposals.

## How it works

```
Feed post (inline, splash.html)          Full game (expanded, game.html)
  first question, tap to answer   --->     guess on a 10 x 10 crowd, reveal, day card
            |                                         |
            +------------- /api (Hono) ---------------+
                              |
         Devvit Redis: votes, guesses, scores, streaks, proposals
         Devvit realtime: live subreddit counts on open reveals
         Devvit scheduler: a new edition each day
         Reddit API: daily post, results thread, comments as the player
         Devvit Journeys: start, progress, interactions, end with score
```

- `src/shared/` holds the rules: scoring, tiers and verdict lines, edition dates, the subreddit-versus-survey line, proposal checks.
- `src/server/core/` runs editions, votes, guesses, streaks, proposals and comments.
- `src/server/content/questions.json` is the question bank. The survey shares never reach the browser before the guess is locked.
- `src/client/` draws the game in SVG and CSS: Isotype figures, census-form answer rows and a rubber stamp.

## Run it

Requires Node 24.

```bash
npm install
npm test                 # 171 tests, no network, no Reddit account
npm run dev:api          # local API on :8787, using Reddit's own test mocks
npm run dev:web          # local client on :5173, open /splash.html or /game.html
```

`DEV_PLAYERS=30 npm run dev:api` adds simulated local players so the subreddit rows have something to show during development.

To run it on Reddit: `npm run login`, then `npm run dev` to playtest in a test subreddit, or `npm run deploy` to upload a build.

## Tests

- `tests/shared`: scoring boundaries and properties, tiers, verdict lines, edition dates, the comparison line, proposal checks, summaries.
- `tests/content`: every bank question is checked for wording length, answers, shares, licence and source; every FiveThirtyEight share is recomputed from its raw file.
- `tests/server`: the real Hono routes under Reddit's `@devvit/test` harness: editions, one vote per player, logged-out play, scoring, ranks, streaks, the daily job, proposals, verdicts and telemetry routes.

## Licence

Code: BSD 3-Clause, including parts of Reddit's Devvit React template. Survey data in `content/fivethirtyeight/`: FiveThirtyEight, CC BY 4.0. Font: Jost, SIL Open Font License.
