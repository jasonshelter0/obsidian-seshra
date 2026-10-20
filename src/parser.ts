export const ENTITY_TYPES = ['TASK', 'METHOD', 'MECH', 'PRIOR', 'DATA', 'METRIC', 'FAIL', 'TOOL', 'THEME'] as const;
export const REASONING_TYPES = ['P', 'Q', 'H', 'C', 'E', 'A', 'X', 'T', 'R', 'D', 'N'] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type ReasoningType = (typeof REASONING_TYPES)[number];
export type RsStatus = '+' | '?' | '~' | '-';
export type RsRelation = { key: string; values: string[]; line: number };
export type RsBlock = {
  kind: 'entity' | 'reasoning' | 'explanation';
  key: string;
  type: string;
  title: string;
  status?: RsStatus;
  text: string;
  sourceFile: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  relations: RsRelation[];
  sources: string[];
};
export type RsReference = {
  kind: 'entity' | 'reasoning';
  key: string;
  sourceFile: string;
  line: number;
  from: number;
  to: number;
};
export type RsDocument = { blocks: RsBlock[]; references: RsReference[] };

const entityPattern = /^\[(TASK|METHOD|MECH|PRIOR|DATA|METRIC|FAIL|TOOL|THEME)\] +(.+?)\s*$/;
const reasoningPattern = /^([PQHCEAXTRDN])(\d+)([+?~-])?:\s*(.*)$/;
const explanationPattern = /^#{2,6} +Explain +[—-] +\[\[([^\]]+)\]\]\s*$/i;
const relationPattern = /^\s*\|\s*([\w-]+)\s*:\s*(.*?)\s*$/;
const sourcePattern = /@(?:[\p{L}\p{N}][\p{L}\p{N}._-]*)(?::[\p{L}\p{N}._-]+)?/gu;
const wikiPattern = /\[\[([^\]]+)\]\]/g;
const reasoningRefPattern = /\b([PQHCEAXTRDN]\d+)\b/g;

export function normalizeEntity(value: string): string {
  return value.split('|')[0].split('#')[0].trim().toLocaleLowerCase();
}

export function parseRs(markdown: string, sourceFile = ''): RsDocument {
  const rawLines = markdown.split('\n');
  const lines = rawLines.map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
  const starts: number[] = [];
  let offset = 0;
  for (const line of rawLines) {
    starts.push(offset);
    offset += line.length + 1;
  }

  const blocks: RsBlock[] = [];
  const references: RsReference[] = [];
  let fence: { character: string; length: number } | null = null;
  let current: RsBlock | null = null;

  const finish = (line: number) => {
    if (!current) return;
    current.endLine = Math.max(current.startLine, line - 1);
    current.endOffset = starts[current.endLine] + lines[current.endLine].length;
    blocks.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) fence = { character: marker[0], length: marker.length };
      else if (fence.character === marker[0] && marker.length >= fence.length && !fenceMatch[2].trim()) fence = null;
      finish(i);
      continue;
    }
    if (fence) continue;

    const entity = entityPattern.exec(line);
    const reasoning = reasoningPattern.exec(line);
    const explanation = explanationPattern.exec(line);
    if (entity || reasoning || explanation) {
      finish(i);
      const kind = entity ? 'entity' : reasoning ? 'reasoning' : 'explanation';
      const title = entity ? entity[2].trim() : reasoning ? reasoning[4].trim() : explanation![1].trim();
      const key = entity ? normalizeEntity(title) : reasoning ? `${reasoning[1]}${reasoning[2]}` : normalizeEntity(title);
      current = {
        kind, key, type: entity ? entity[1] : reasoning ? reasoning[1] : 'Explain', title,
        status: reasoning?.[3] as RsStatus | undefined, text: '', sourceFile,
        startLine: i, endLine: i, startOffset: starts[i], endOffset: starts[i] + line.length,
        relations: [], sources: [],
      };
    } else if (current) {
      const endsEntity = current.kind === 'entity' && !/^\s*(?:::|\|)/.test(line);
      if ((current.kind !== 'explanation' && !line.trim()) || /^#{1,6} +/.test(line) || endsEntity) {
        finish(i);
      } else {
        const relation = relationPattern.exec(line);
        if (relation) {
          current.relations.push({ key: relation[1].toLowerCase(), values: splitValues(relation[2]), line: i });
        } else if (/^\s*\|\s*@/.test(line)) {
          // A provenance-only line belongs to the block, not its prose body.
        } else if (line.startsWith('::') && current.kind === 'entity') {
          current.text += (current.text ? '\n' : '') + line.slice(2).trim();
        } else {
          current.text += (current.text ? '\n' : '') + line;
        }
      }
    }

    for (const match of line.matchAll(wikiPattern)) {
      references.push({ kind: 'entity', key: normalizeEntity(match[1]), sourceFile, line: i, from: starts[i] + match.index!, to: starts[i] + match.index! + match[0].length });
    }
    if (current) {
      for (const match of line.matchAll(sourcePattern)) {
        if (!current.sources.includes(match[0])) current.sources.push(match[0]);
      }
      const relation = relationPattern.exec(line);
      if (relation && ['sup', 'opp', 'dep', 'lim', 'test', 'result'].includes(relation[1].toLowerCase())) {
        for (const match of relation[2].matchAll(reasoningRefPattern)) {
          references.push({ kind: 'reasoning', key: match[1], sourceFile, line: i,
            from: starts[i] + line.indexOf(relation[2]) + match.index!,
            to: starts[i] + line.indexOf(relation[2]) + match.index! + match[0].length });
        }
      }
    }
  }
  finish(lines.length);
  return { blocks, references };
}

function splitValues(value: string): string[] {
  return value.split(/,(?![^\[]*\]\])/).map(part => part.trim()).filter(Boolean);
}
