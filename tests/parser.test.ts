import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRs } from '../src/parser.ts';
import { RsIndex } from '../src/index.ts';
import { buildEntityRelations, buildEvidenceGroups } from '../src/visual-model.ts';

test('recognizes explicit RS blocks while leaving prose and fenced examples alone', () => {
  const markdown = [
    'Ordinary prose about [METHOD] methods.',
    '```markdown',
    '[METHOD] Fake',
    'C99+: fake',
    '```',
    '',
    '[METHOD] ALCNet',
    ':: Local contrast',
    '| task:[[SIRST]]',
    '',
    'C1+: Claim about [[SIRST]]',
    '| sup:E1,E2',
    '| @self:synthesis',
  ].join('\n');
  const document = parseRs(markdown, 'note.md');
  assert.deepEqual(document.blocks.map(block => block.key), ['alcnet', 'C1']);
  assert.equal(document.blocks[0].text, 'Local contrast');
  assert.deepEqual(document.blocks[1].relations[0].values, ['E1', 'E2']);
  assert.deepEqual(document.blocks[1].sources, ['@self:synthesis']);
  assert.doesNotMatch(document.blocks[1].text, /@self:synthesis/);
  assert.deepEqual(document.references.filter(ref => ref.kind === 'reasoning').map(ref => ref.key), ['E1', 'E2']);
  assert.equal(document.references.filter(ref => ref.key === 'sirst').length, 2);
});

test('indexes vault-wide evidence and updates modified files', () => {
  const index = new RsIndex();
  index.update('claim.md', 'C1+: A claim\n| sup:E1');
  assert.deepEqual(index.getDiagnostics('claim.md'), ['Line 2: undefined E1']);
  index.update('evidence.md', 'E1: An observation');
  assert.deepEqual(index.getDiagnostics('claim.md'), []);
  assert.equal(index.getIncomingReasoning('E1')[0].key, 'C1');
  index.update('evidence.md', 'E2: Changed observation');
  assert.deepEqual(index.getDiagnostics('claim.md'), ['Line 2: undefined E1']);
});

test('keeps explanation paragraphs and tracks entity mentions', () => {
  const markdown = '### Explain — [[SCR]]\nFirst paragraph.\n\nSecond paragraph.\n';
  const document = parseRs(markdown, 'learn.md');
  assert.equal(document.blocks.length, 1);
  assert.match(document.blocks[0].text, /Second paragraph/);
  assert.equal(document.references[0].key, 'scr');
});

test('does not absorb prose after an entity or parse a fenced example', () => {
  const document = parseRs('[METHOD] ALCNet\n:: definition\nOrdinary prose.\n```md\nE9: fake\n```', 'note.md');
  assert.equal(document.blocks.length, 1);
  assert.equal(document.blocks[0].text, 'definition');
  assert.equal(document.blocks[0].endLine, 1);
});

test('preserves reference offsets in CRLF notes and follows file renames', () => {
  const markdown = '[METHOD] ALCNet\r\n| task:[[SIRST]]\r\n';
  const document = parseRs(markdown, 'old.md');
  const reference = document.references[0];
  assert.equal(markdown.slice(reference.from, reference.to), '[[SIRST]]');
  const index = new RsIndex();
  index.update('old.md', markdown);
  index.rename('old.md', 'new.md');
  assert.equal(index.getEntity('ALCNet')[0].sourceFile, 'new.md');
  assert.equal(index.getMentions('SIRST')[0].sourceFile, 'new.md');
});

test('groups evidence with source text and flags missing definitions', () => {
  const index = new RsIndex();
  index.update('claim.md', 'C3+: Feature preservation helps.\n| sup:E1,E1,E4\n| opp:E9\n| lim:X3');
  index.update('evidence.md', 'E1: Measured improvement');
  const claim = index.getReasoning('C3')[0];
  const groups = buildEvidenceGroups(index, claim);
  assert.deepEqual(groups.map(group => [group.key, group.items.length]), [['sup', 2], ['opp', 1], ['lim', 1]]);
  assert.equal(groups[0].items[0].block?.title, 'Measured improvement');
  assert.equal(groups[0].items[1].block, undefined);
});

test('extracts entity relation chips without treating plain properties as links', () => {
  const block = parseRs('[METHOD] ALCNet\n| task:[[SIRST]]\n| theme:[[Feature Preservation]],Other', 'methods.md').blocks[0];
  assert.deepEqual(buildEntityRelations(block), [
    { key: 'task', values: [{ name: 'SIRST', linked: true }] },
    { key: 'theme', values: [{ name: 'Feature Preservation', linked: true }, { name: 'Other', linked: false }] },
  ]);
});
