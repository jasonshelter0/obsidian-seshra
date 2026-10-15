import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRs } from '../src/parser.ts';
import { RsIndex } from '../src/index.ts';

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
