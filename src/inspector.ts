import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import type RsPlugin from './main';
import type { RsBlock } from './parser';
import type { RsTarget } from './editor';
import { buildEntityRelations, buildEvidenceGroups } from './visual-model';

export const INSPECTOR_VIEW = 'seshra-inspector';

export class RsInspector extends ItemView {
  private target: RsTarget | null = null;
  private overviewPath: string | null = null;
  private readonly history: RsTarget[] = [];

  constructor(leaf: WorkspaceLeaf, private readonly plugin: RsPlugin) { super(leaf); }
  getViewType() { return INSPECTOR_VIEW; }
  getDisplayText() { return 'RS Inspector'; }
  getIcon() { return 'scan-eye'; }
  async onOpen() { this.render(); }
  async onClose() { this.target = null; this.overviewPath = null; this.history.length = 0; }

  showOverview(path: string) {
    this.overviewPath = path;
    this.target = null;
    this.history.length = 0;
    this.render();
  }

  show(target: RsTarget) {
    if (this.target && (this.target.kind !== target.kind || this.target.key !== target.key)) this.history.push(this.target);
    this.target = target;
    this.render();
  }

  refresh() { if (this.target || this.overviewPath) this.render(); }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('seshra-inspector');
    if (!this.target) {
      if (this.overviewPath) this.renderOverview(root, this.overviewPath);
      else root.createEl('p', { cls: 'rs-inspector-empty', text: 'Open RS overview, Alt-click an RS heading or [[entity]], or use “Inspect RS at cursor”.' });
      return;
    }
    const { kind, key } = this.target;
    const definitions = kind === 'entity' ? this.plugin.index.getEntity(key) : this.plugin.index.getReasoning(key);
    const hero = root.createDiv({ cls: 'rs-inspector-hero' });
    if (this.history.length || this.overviewPath) this.button(hero, '← Back', () => this.back(), 'rs-back-button');
    hero.createDiv({ cls: 'rs-inspector-eyebrow', text: kind === 'entity' ? 'ENTITY INSPECTOR' : 'REASONING INSPECTOR' });
    hero.createEl('h2', { text: kind === 'entity' ? definitions[0]?.title ?? key : key });
    hero.createDiv({ cls: 'rs-inspector-subtitle', text: definitions.length ? `${definitions.length} definition${definitions.length === 1 ? '' : 's'} in Markdown` : 'No definition found in indexed Markdown' });
    if (!definitions.length) return;

    const first = definitions[0];
    if (kind === 'reasoning') this.renderEvidenceMap(root, first);
    else this.renderEntityMap(root, first);
    root.createEl('h3', { text: definitions.length > 1 ? 'Definitions' : 'Definition' });
    for (const block of definitions) this.renderBlock(root, block);

    if (kind === 'entity') {
      this.renderList(root, 'Related reasoning', this.plugin.index.getRelatedReasoning(key));
      const mentions = this.plugin.index.getMentions(key);
      if (mentions.length) {
        root.createEl('h3', { text: `Mentions (${mentions.length})` });
        const list = root.createDiv({ cls: 'rs-mention-list' });
        for (const mention of mentions.slice(0, 100)) this.link(list, `${mention.sourceFile}:${mention.line + 1}`, mention.sourceFile, mention.line);
      }
    } else this.renderList(root, 'Referenced by', this.plugin.index.getIncomingReasoning(key));
  }

  private renderOverview(root: HTMLElement, path: string) {
    const document = this.plugin.index.getDocument(path);
    const blocks = document?.blocks.filter(block => block.kind !== 'explanation') ?? [];
    const entities = blocks.filter(block => block.kind === 'entity');
    const reasoning = blocks.filter(block => block.kind === 'reasoning');
    const hero = root.createDiv({ cls: 'rs-inspector-hero' });
    hero.createDiv({ cls: 'rs-inspector-eyebrow', text: 'NOTE OVERVIEW' });
    hero.createEl('h2', { text: path.split('/').pop() ?? path });
    const stats = hero.createDiv({ cls: 'rs-overview-stats' });
    stats.createSpan({ text: `${entities.length} entities` });
    stats.createSpan({ text: `${reasoning.length} reasoning` });
    stats.createSpan({ text: `${reasoning.filter(block => block.status === '?').length} open` });
    if (!blocks.length) {
      root.createEl('p', { cls: 'rs-inspector-empty', text: 'No RS blocks found in this note. Ordinary Markdown is left untouched.' });
      return;
    }
    this.renderOverviewGroup(root, 'Entities', entities);
    this.renderOverviewGroup(root, 'Reasoning', reasoning);
  }

  private renderOverviewGroup(root: HTMLElement, title: string, blocks: RsBlock[]) {
    if (!blocks.length) return;
    root.createEl('h3', { text: `${title} (${blocks.length})` });
    const list = root.createDiv({ cls: 'rs-overview-list' });
    for (const block of blocks) {
      const row = list.createDiv({ cls: `rs-overview-row rs-overview-${block.kind} rs-status-${statusClass(block.status)}` });
      row.createSpan({ cls: 'rs-overview-badge', text: block.kind === 'entity' ? block.type : `${block.key}${block.status ?? ''}` });
      this.button(row, block.kind === 'entity' ? block.title : block.title || block.text.split('\n')[0] || block.key,
        () => this.show({ kind: block.kind as 'entity' | 'reasoning', key: block.key }), 'rs-overview-title');
      this.link(row, '↗', block.sourceFile, block.startLine);
    }
  }

  private renderEvidenceMap(root: HTMLElement, claim: RsBlock) {
    const groups = buildEvidenceGroups(this.plugin.index, claim);
    root.createEl('h3', { text: 'Evidence & reasoning' });
    const flow = root.createDiv({ cls: 'rs-evidence-flow' });
    const focus = flow.createDiv({ cls: `rs-flow-focus rs-status-${statusClass(claim.status)}` });
    focus.createSpan({ cls: 'rs-flow-id', text: `${claim.key}${claim.status ?? ''}` });
    focus.createSpan({ cls: 'rs-flow-text', text: claim.title || claim.text || 'No statement text' });
    if (!groups.length) {
      flow.createDiv({ cls: 'rs-flow-empty', text: 'No relations yet. Add | sup:E1, | opp:E2, | dep:A1, or | lim:X1 in Markdown.' });
      return;
    }
    for (const group of groups) {
      const lane = flow.createDiv({ cls: `rs-flow-lane rs-tone-${group.tone}` });
      lane.createDiv({ cls: 'rs-flow-label', text: `${group.label} · ${group.items.length}` });
      const items = lane.createDiv({ cls: 'rs-flow-items' });
      for (const item of group.items) {
        const card = items.createDiv({ cls: `rs-flow-card${item.block ? '' : ' rs-flow-missing'}` });
        this.button(card, item.id, () => void this.plugin.openInspector({ kind: 'reasoning', key: item.id }), 'rs-flow-card-id');
        card.createSpan({ cls: 'rs-flow-card-text', text: item.block?.title || item.block?.text || 'Missing definition' });
        if (item.block) this.link(card, '↗', item.block.sourceFile, item.block.startLine);
      }
    }
  }

  private renderEntityMap(root: HTMLElement, entity: RsBlock) {
    const relations = buildEntityRelations(entity);
    root.createEl('h3', { text: 'Entity relations' });
    const map = root.createDiv({ cls: 'rs-entity-map' });
    const focus = map.createDiv({ cls: 'rs-entity-focus' });
    focus.createSpan({ cls: 'rs-entity-focus-type', text: entity.type });
    focus.createSpan({ text: entity.title });
    if (!relations.length) {
      map.createDiv({ cls: 'rs-flow-empty', text: 'No relations yet. Add a line such as | task:[[SIRST]] in Markdown.' });
      return;
    }
    const rows = map.createDiv({ cls: 'rs-entity-relations' });
    for (const relation of relations) {
      const row = rows.createDiv({ cls: 'rs-entity-relation' });
      row.createSpan({ cls: 'rs-entity-relation-label', text: relation.key });
      const values = row.createDiv({ cls: 'rs-entity-relation-values' });
      for (const value of relation.values) {
        if (value.linked) this.button(values, value.name, () => void this.plugin.openInspector({ kind: 'entity', key: value.name }), 'rs-relation-chip');
        else values.createSpan({ cls: 'rs-relation-chip rs-relation-plain', text: value.name });
      }
    }
  }

  private renderBlock(root: HTMLElement, block: RsBlock) {
    const section = root.createDiv({ cls: 'rs-inspector-block' });
    section.createSpan({ cls: `rs-inspector-type rs-status-${statusClass(block.status)}`, text: `${block.type}${block.status ?? ''}` });
    if (block.title && block.kind === 'reasoning') section.createEl('p', { cls: 'rs-definition-title', text: block.title });
    if (block.text) section.createEl('p', { cls: 'rs-definition-text', text: block.text });
    if (block.relations.length) {
      const details = section.createEl('details', { cls: 'rs-property-details' });
      details.createEl('summary', { text: `Properties (${block.relations.length})` });
      for (const relation of block.relations) {
        const row = details.createDiv({ cls: 'rs-property-row' });
        row.createSpan({ text: `${relation.key}: ` });
        relation.values.forEach((value, index) => {
          if (index) row.createSpan({ text: ', ' });
          const id = /^[PQHCEAXTRDN]\d+$/i.test(value) ? value.toUpperCase() : null;
          const wiki = /^\[\[([^\]]+)\]\]$/.exec(value);
          if (id) this.button(row, id, () => void this.plugin.openReasoning(id));
          else if (wiki) this.button(row, wiki[1], () => void this.plugin.openInspector({ kind: 'entity', key: wiki[1] }));
          else row.createSpan({ text: value });
        });
      }
    }
    if (block.sources.length) {
      const sources = section.createDiv({ cls: 'rs-inspector-sources' });
      for (const source of block.sources) sources.createSpan({ cls: 'rs-source-chip', text: source });
    }
    this.link(section, `${block.sourceFile}:${block.startLine + 1} ↗`, block.sourceFile, block.startLine);
  }

  private renderList(root: HTMLElement, title: string, blocks: RsBlock[]) {
    if (!blocks.length) return;
    root.createEl('h3', { text: `${title} (${blocks.length})` });
    for (const block of blocks.slice(0, 100)) {
      const row = root.createDiv({ cls: 'rs-inspector-list-item' });
      this.button(row, `${block.key}${block.status ?? ''}: ${block.title || block.text.slice(0, 72)}`, () => void this.plugin.openInspector({ kind: 'reasoning', key: block.key }));
      this.link(row, '↗', block.sourceFile, block.startLine);
    }
  }

  private back() { this.target = this.history.pop() ?? null; this.render(); }
  private link(root: HTMLElement, label: string, path: string, line: number) {
    this.button(root, label, () => void this.jump(path, line), 'rs-jump-button');
  }
  private button(root: HTMLElement, label: string, action: () => void, className = '') {
    const button = root.createEl('button', { cls: `rs-text-button ${className}`, text: label });
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

function statusClass(status?: string): string {
  return status === '+' ? 'supported' : status === '?' ? 'open' : status === '~' ? 'contested' : status === '-' ? 'defeated' : 'neutral';
}
