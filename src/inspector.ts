import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import type RsPlugin from './main';
import type { RsBlock } from './parser';
import type { RsTarget } from './editor';

export const INSPECTOR_VIEW = 'seshra-inspector';

export class RsInspector extends ItemView {
  private target: RsTarget | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: RsPlugin) { super(leaf); }
  getViewType() { return INSPECTOR_VIEW; }
  getDisplayText() { return 'RS Inspector'; }
  getIcon() { return 'scan-eye'; }
  async onOpen() { this.render(); }
  async onClose() { this.target = null; }

  show(target: RsTarget) {
    this.target = target;
    this.render();
  }

  refresh() { if (this.target) this.render(); }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('seshra-inspector');
    if (!this.target) {
      root.createEl('p', { text: 'Alt-click an RS heading or [[entity]], or use “Inspect RS at cursor”.' });
      return;
    }
    const { kind, key } = this.target;
    const definitions = kind === 'entity' ? this.plugin.index.getEntity(key) : this.plugin.index.getReasoning(key);
    root.createEl('h2', { text: kind === 'entity' ? definitions[0]?.title ?? key : key });
    root.createEl('div', { cls: 'rs-inspector-subtitle', text: kind === 'entity' ? 'Entity' : 'Reasoning' });
    if (!definitions.length) root.createEl('p', { text: 'No definition found in indexed Markdown files.' });
    for (const block of definitions) this.renderBlock(root, block);
    if (kind === 'entity') {
      const related = this.plugin.index.getRelatedReasoning(key);
      this.renderList(root, 'Related reasoning', related);
      const mentions = this.plugin.index.getMentions(key);
      if (mentions.length) {
        root.createEl('h3', { text: `Mentions (${mentions.length})` });
        for (const mention of mentions.slice(0, 100)) this.link(root, `${mention.sourceFile}:${mention.line + 1}`, mention.sourceFile, mention.line);
      }
    } else {
      this.renderList(root, 'Referenced by', this.plugin.index.getIncomingReasoning(key));
    }
  }

  private renderBlock(root: HTMLElement, block: RsBlock) {
    const section = root.createDiv({ cls: 'rs-inspector-block' });
    section.createEl('div', { cls: 'rs-inspector-type', text: `${block.type}${block.status ?? ''}` });
    if (block.title) section.createEl('p', { text: block.title });
    if (block.text) section.createEl('p', { text: block.text });
    for (const relation of block.relations) {
      const row = section.createDiv({ cls: 'rs-inspector-relation' });
      row.createSpan({ text: `${relation.key}: ` });
      relation.values.forEach((value, index) => {
        if (index) row.createSpan({ text: ', ' });
        const reasoningId = /^[PQHCEAXTRDN]\d+$/i.test(value) ? value.toUpperCase() : null;
        const wiki = /^\[\[([^\]]+)\]\]$/.exec(value);
        if (reasoningId) this.button(row, value, () => this.plugin.openReasoning(reasoningId));
        else if (wiki) this.button(row, wiki[1], () => this.plugin.openInspector({ kind: 'entity', key: wiki[1] }));
        else row.createSpan({ text: value });
      });
    }
    if (block.sources.length) section.createDiv({ cls: 'rs-inspector-sources', text: block.sources.join(' · ') });
    this.link(section, `${block.sourceFile}:${block.startLine + 1} ↗`, block.sourceFile, block.startLine);
  }

  private renderList(root: HTMLElement, title: string, blocks: RsBlock[]) {
    if (!blocks.length) return;
    root.createEl('h3', { text: `${title} (${blocks.length})` });
    for (const block of blocks.slice(0, 100)) {
      const row = root.createDiv({ cls: 'rs-inspector-list-item' });
      this.button(row, `${block.key}${block.status ?? ''}: ${block.title || block.text.slice(0, 72)}`, () => {
        this.plugin.openInspector({ kind: 'reasoning', key: block.key });
      });
      this.link(row, '↗', block.sourceFile, block.startLine);
    }
  }

  private link(root: HTMLElement, label: string, path: string, line: number) {
    this.button(root, label, () => void this.jump(path, line));
  }

  private button(root: HTMLElement, label: string, action: () => void) {
    const button = root.createEl('button', { cls: 'rs-text-button', text: label });
    button.addEventListener('click', action);
  }

  private async jump(path: string, line: number) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    if (leaf.view instanceof MarkdownView) {
      leaf.view.editor.setCursor({ line, ch: 0 });
      leaf.view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
    }
  }
}
