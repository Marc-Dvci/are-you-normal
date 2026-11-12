// Writes the test and coverage tables to the GitHub job summary.
import { existsSync, readFileSync } from 'node:fs';

const read = (path) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const slash = (p) => p.split('\\').join('/');
const results = read('coverage/results.json');
const coverage = read('coverage/coverage-summary.json');
const out = ['## Are You Normal? test run', ''];

if (results) {
  out.push('| Tests | Passed | Failed | Skipped |', '|---:|---:|---:|---:|');
  out.push(
    `| ${results.numTotalTests} | ${results.numPassedTests} | ${results.numFailedTests} | ${results.numPendingTests + results.numTodoTests} |`,
    ''
  );
  const groups = new Map();
  for (const file of results.testResults) {
    const key = slash(file.name).split('/tests/')[1]?.split('/')[0] ?? 'other';
    groups.set(key, (groups.get(key) ?? 0) + file.assertionResults.length);
  }
  out.push('| Suite | Tests |', '|---|---:|');
  for (const [k, v] of groups) out.push(`| ${k} | ${v} |`);
  out.push('');
}

if (coverage) {
  out.push('| Code | Lines | Branches |', '|---|---:|---:|');
  const byDir = new Map();
  for (const [file, c] of Object.entries(coverage)) {
    if (file === 'total') continue;
    const dir =
      slash(file).split('/src/')[1]?.split('/').slice(0, -1).join('/') ?? file;
    const acc = byDir.get(dir) ?? { lt: 0, lc: 0, bt: 0, bc: 0 };
    acc.lt += c.lines.total;
    acc.lc += c.lines.covered;
    acc.bt += c.branches.total;
    acc.bc += c.branches.covered;
    byDir.set(dir, acc);
  }
  const pct = (a, b) => (b === 0 ? '100.0' : ((100 * a) / b).toFixed(1));
  for (const [dir, a] of byDir) {
    out.push(`| src/${dir} | ${pct(a.lc, a.lt)}% | ${pct(a.bc, a.bt)}% |`);
  }
  const t = coverage.total;
  out.push(`| **all** | **${t.lines.pct}%** | **${t.branches.pct}%** |`);
}

console.log(out.join('\n'));
