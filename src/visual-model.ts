import type { RsIndex } from './index.ts';
import type { RsBlock } from './parser.ts';

export const REASONING_RELATIONS = [
  { key: 'sup', label: 'Supporting evidence', tone: 'support' },
  { key: 'opp', label: 'Counter evidence', tone: 'counter' },
  { key: 'dep', label: 'Assumptions', tone: 'assumption' },
  { key: 'lim', label: 'Limitations', tone: 'limitation' },
  { key: 'test', label: 'Tests', tone: 'test' },
  { key: 'result', label: 'Results', tone: 'result' },
] as const;

export type EvidenceItem = { id: string; block?: RsBlock };
export type EvidenceGroup = {
  key: string;
  label: string;
  tone: string;
  items: EvidenceItem[];
};

export function buildEvidenceGroups(index: RsIndex, block: RsBlock): EvidenceGroup[] {
  return REASONING_RELATIONS.map(relation => {
    const ids = block.relations
      .filter(item => item.key === relation.key)
      .flatMap(item => item.values)
      .filter(value => /^[PQHCEAXTRDN]\d+$/i.test(value))
      .map(value => value.toUpperCase());
    const unique = [...new Set(ids)];
    return {
      ...relation,
      items: unique.map(id => {
        const definitions = index.getReasoning(id);
        return { id, block: definitions.find(item => item.sourceFile === block.sourceFile) ?? definitions[0] };
      }),
    };
  }).filter(group => group.items.length);
}

export type EntityRelation = { key: string; values: { name: string; linked: boolean }[] };

export function buildEntityRelations(block: RsBlock): EntityRelation[] {
  return block.relations
    .filter(relation => !['sup', 'opp', 'dep', 'lim', 'test', 'result'].includes(relation.key))
    .map(relation => ({
      key: relation.key,
      values: relation.values.map(value => {
        const wiki = /^\[\[([^\]]+)\]\]$/.exec(value);
        return { name: wiki ? wiki[1] : value, linked: Boolean(wiki) };
      }),
    }));
}
