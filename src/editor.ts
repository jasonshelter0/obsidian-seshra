import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { parseRs, type RsDocument } from './parser';

export type RsTarget = { kind: 'entity' | 'reasoning'; key: string };

export function createRsEditorExtension(open: (target: RsTarget) => void, jump: (id: string) => void) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    document: RsDocument;

    constructor(view: EditorView) {
      this.document = parseRs(view.state.doc.toString());
      this.decorations = makeDecorations(view, this.document);
    }

    update(update: ViewUpdate) {
      if (!update.docChanged && !update.viewportChanged) return;
      if (update.docChanged) this.document = parseRs(update.state.doc.toString());
      this.decorations = makeDecorations(update.view, this.document);
    }

  }, {
    decorations: plugin => plugin.decorations,
    eventHandlers: {
      click(event, view) {
        if (!event.altKey) return false;
        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) return false;
        const document = parseRs(view.state.doc.toString());
        const ref = document.references.find(item => position >= item.from && position <= item.to);
        if (ref) {
          event.preventDefault();
          event.stopPropagation();
          if (ref.kind === 'reasoning') jump(ref.key);
          else open({ kind: 'entity', key: ref.key });
          return true;
        }
        const block = document.blocks.find(item => position >= item.startOffset && position <= view.state.doc.line(item.startLine + 1).to);
        if (block?.kind === 'entity' || block?.kind === 'reasoning') {
          event.preventDefault();
          event.stopPropagation();
          open({ kind: block.kind, key: block.key });
          return true;
        }
        return false;
      },
    },
  });
}

function makeDecorations(view: EditorView, document: RsDocument): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const mark = (from: number, to: number, className: string) => {
    if (from < to) ranges.push(Decoration.mark({ class: className }).range(from, to));
  };
  const min = view.viewport.from;
  const max = view.viewport.to;
  for (const block of document.blocks) {
    if (block.startOffset > max || block.endOffset < min) continue;
    const line = view.state.doc.line(block.startLine + 1);
    ranges.push(Decoration.line({ attributes: { class: `rs-line rs-line-${block.kind} rs-line-${statusClass(block.status)}` } }).range(line.from));
    if (block.kind === 'entity') {
      const end = Math.min(line.to, line.from + block.type.length + 2);
      mark(line.from, end, `rs-entity rs-entity-${block.type.toLowerCase()}`);
    } else if (block.kind === 'reasoning') {
      const match = /^[PQHCEAXTRDN]\d+[+?~-]?:/.exec(line.text);
      if (match) mark(line.from, line.from + match[0].length, `rs-reasoning rs-status-${statusClass(block.status)}`);
    } else {
      mark(line.from, line.to, 'rs-explanation');
    }
    for (const relation of block.relations) {
      const propertyLine = view.state.doc.line(relation.line + 1);
      if (propertyLine.from <= max && propertyLine.to >= min && propertyLine.from < propertyLine.to) {
        const prefix = /^\s*\|\s*[\w-]+\s*:/.exec(propertyLine.text);
        if (prefix) mark(propertyLine.from, propertyLine.from + prefix[0].length, 'rs-property');
      }
    }
    for (let lineNumber = block.startLine + 1; lineNumber <= block.endLine; lineNumber++) {
      const bodyLine = view.state.doc.line(lineNumber + 1);
      if (bodyLine.from > max || bodyLine.to < min) continue;
      for (const match of bodyLine.text.matchAll(/@(?:[\p{L}\p{N}][\p{L}\p{N}._-]*)(?::[\p{L}\p{N}._-]+)?/gu)) {
        mark(bodyLine.from + match.index!, bodyLine.from + match.index! + match[0].length, 'rs-source');
      }
    }
  }
  for (const reference of document.references) {
    if (reference.from < min || reference.to > max) continue;
    mark(reference.from, reference.to, reference.kind === 'reasoning' ? 'rs-reasoning-ref' : 'rs-entity-ref');
  }
  return Decoration.set(ranges, true);
}

function statusClass(status?: string): string {
  return status === '+' ? 'supported' : status === '?' ? 'open' : status === '~' ? 'contested' : status === '-' ? 'defeated' : 'neutral';
}
