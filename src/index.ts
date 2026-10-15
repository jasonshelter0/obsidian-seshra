import { normalizeEntity, parseRs, type RsBlock, type RsDocument, type RsReference } from './parser.ts';

export type IndexedBlock = RsBlock;
export type IndexedReference = RsReference;

export class RsIndex {
  private readonly files = new Map<string, RsDocument>();
  private readonly entities = new Map<string, RsBlock[]>();
  private readonly reasoning = new Map<string, RsBlock[]>();
  private readonly mentions = new Map<string, RsReference[]>();

  update(path: string, markdown: string): void {
    this.remove(path);
    const document = parseRs(markdown, path);
    this.files.set(path, document);
    this.addDocument(document);
  }

  remove(path: string): void {
    const document = this.files.get(path);
    if (document) this.removeDocument(document);
    this.files.delete(path);
  }

  rename(oldPath: string, newPath: string): void {
    const old = this.files.get(oldPath);
    if (!old) return;
    this.removeDocument(old);
    this.files.delete(oldPath);
    for (const block of old.blocks) block.sourceFile = newPath;
    for (const reference of old.references) reference.sourceFile = newPath;
    this.files.set(newPath, old);
    this.addDocument(old);
  }

  getDocument(path: string): RsDocument | undefined { return this.files.get(path); }
  getEntity(name: string): RsBlock[] { return this.entities.get(normalizeEntity(name)) ?? []; }
  getReasoning(id: string): RsBlock[] { return this.reasoning.get(id.toUpperCase()) ?? []; }
  getMentions(name: string): RsReference[] { return this.mentions.get(normalizeEntity(name)) ?? []; }

  getRelatedReasoning(name: string): RsBlock[] {
    const key = normalizeEntity(name);
    const related: RsBlock[] = [];
    for (const document of this.files.values()) {
      for (const block of document.blocks) {
        if (block.kind !== 'reasoning') continue;
        const refs = document.references.filter(ref => ref.kind === 'entity' && ref.key === key && ref.line >= block.startLine && ref.line <= block.endLine);
        if (refs.length) related.push(block);
      }
    }
    return related;
  }

  getIncomingReasoning(id: string): RsBlock[] {
    const related: RsBlock[] = [];
    for (const document of this.files.values()) {
      for (const block of document.blocks) {
        if (block.kind === 'reasoning' && block.relations.some(rel => rel.values.some(value => value.toUpperCase() === id.toUpperCase()))) related.push(block);
      }
    }
    return related;
  }

  getDiagnostics(path: string): string[] {
    const document = this.files.get(path);
    if (!document) return [];
    const warnings: string[] = [];
    for (const block of document.blocks) {
      if (block.kind !== 'reasoning') continue;
      if (this.getReasoning(block.key).length > 1) warnings.push(`Line ${block.startLine + 1}: duplicate reasoning ID ${block.key}`);
      for (const relation of block.relations) {
        if (!['sup', 'opp', 'dep', 'lim', 'test', 'result'].includes(relation.key)) continue;
        for (const value of relation.values) {
          if (/^[PQHCEAXTRDN]\d+$/i.test(value) && !this.getReasoning(value).length) warnings.push(`Line ${relation.line + 1}: undefined ${value}`);
        }
      }
    }
    return warnings;
  }

  private addDocument(document: RsDocument): void {
    for (const block of document.blocks) {
      if (block.kind === 'entity') add(this.entities, block.key, block);
      if (block.kind === 'reasoning') add(this.reasoning, block.key, block);
    }
    for (const reference of document.references) {
      if (reference.kind === 'entity') add(this.mentions, reference.key, reference);
    }
  }

  private removeDocument(document: RsDocument): void {
    for (const block of document.blocks) {
      if (block.kind === 'entity') remove(this.entities, block.key, block);
      if (block.kind === 'reasoning') remove(this.reasoning, block.key, block);
    }
    for (const reference of document.references) {
      if (reference.kind === 'entity') remove(this.mentions, reference.key, reference);
    }
  }
}

function add<T>(map: Map<string, T[]>, key: string, value: T): void {
  const items = map.get(key) ?? [];
  items.push(value);
  map.set(key, items);
}

function remove<T>(map: Map<string, T[]>, key: string, value: T): void {
  const items = map.get(key);
  if (!items) return;
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1);
  if (!items.length) map.delete(key);
}
