import { MarkdownView, Notice, Plugin, TFile, type WorkspaceLeaf } from 'obsidian';
import { createRsEditorExtension, type RsTarget } from './editor';
import { RsIndex } from './index';
import { INSPECTOR_VIEW, RsInspector } from './inspector';
import { parseRs } from './parser';

export default class RsPlugin extends Plugin {
  readonly index = new RsIndex();
  private readonly refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async onload() {
    this.registerView(INSPECTOR_VIEW, leaf => new RsInspector(leaf, this));
    this.registerEditorExtension(createRsEditorExtension(
      target => void this.openInspector(target),
      id => void this.openReasoning(id),
    ));
    this.addRibbonIcon('scan-eye', 'Open RS overview', () => void this.openOverview());
    this.addCommand({ id: 'open-note-overview', name: 'Open RS overview for current note', callback: () => void this.openOverview() });
    this.addCommand({ id: 'inspect-at-cursor', name: 'Inspect RS at cursor', editorCallback: () => void this.openInspectorAtCursor() });
    this.addCommand({ id: 'check-current-note', name: 'Check RS references in current note', editorCallback: () => this.showDiagnostics() });
    this.registerEvent(this.app.vault.on('create', file => { if (file instanceof TFile && file.extension === 'md') this.queueRefresh(file); }));
    this.registerEvent(this.app.vault.on('modify', file => { if (file instanceof TFile && file.extension === 'md') this.queueRefresh(file); }));
    this.registerEvent(this.app.vault.on('delete', file => { this.cancelRefresh(file.path); this.index.remove(file.path); this.refreshInspector(); }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.cancelRefresh(oldPath);
      this.index.rename(oldPath, file.path);
      if (file instanceof TFile && file.extension === 'md') this.queueRefresh(file);
      this.refreshInspector();
    }));
    this.registerEvent(this.app.workspace.on('editor-change', (_editor, info) => {
      if (info.file?.extension === 'md') this.queueRefresh(info.file);
    }));
    this.app.workspace.onLayoutReady(() => void this.loadVault());
  }

  onunload() {
    for (const timer of this.refreshTimers.values()) clearTimeout(timer);
    this.refreshTimers.clear();
  }

  async openInspector(target: RsTarget) {
    const inspector = await this.getInspector();
    inspector?.show(target);
  }

  private async openOverview() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') { new Notice('Open a Markdown note first.'); return; }
    const view = this.app.workspace.getLeavesOfType('markdown')
      .map(leaf => leaf.view)
      .find(view => view instanceof MarkdownView && view.file?.path === file.path);
    const markdown = view instanceof MarkdownView ? view.editor.getValue() : await this.app.vault.cachedRead(file);
    this.index.update(file.path, markdown);
    const inspector = await this.getInspector();
    inspector?.showOverview(file.path);
  }

  private async getInspector(): Promise<RsInspector | null> {
    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW)[0] ?? null;
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return null;
      await leaf.setViewState({ type: INSPECTOR_VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf.view as RsInspector;
  }

  async openReasoning(id: string) {
    const block = this.index.getReasoning(id)[0];
    if (!block) { new Notice(`RS reference ${id} has no definition.`); return; }
    const file = this.app.vault.getAbstractFileByPath(block.sourceFile);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    if (leaf.view instanceof MarkdownView) {
      const position = { line: block.startLine, ch: 0 };
      leaf.view.editor.setCursor(position);
      leaf.view.editor.scrollIntoView({ from: position, to: position }, true);
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
    }
    await this.openInspector({ kind: 'reasoning', key: id });
  }

  private async loadVault() {
    for (const file of this.app.vault.getMarkdownFiles()) {
      try { this.index.update(file.path, await this.app.vault.cachedRead(file)); }
      catch (error) { console.error(`Seshra: could not index ${file.path}`, error); }
    }
    this.refreshInspector();
  }

  private queueRefresh(file: TFile) {
    this.cancelRefresh(file.path);
    this.refreshTimers.set(file.path, setTimeout(() => {
      this.refreshTimers.delete(file.path);
      void this.refreshFile(file);
    }, 250));
  }

  private cancelRefresh(path: string) {
    const timer = this.refreshTimers.get(path);
    if (timer) clearTimeout(timer);
    this.refreshTimers.delete(path);
  }

  private async refreshFile(file: TFile) {
    try {
      const view = this.app.workspace.getLeavesOfType('markdown')
        .map(leaf => leaf.view)
        .find(view => view instanceof MarkdownView && view.file?.path === file.path);
      const markdown = view instanceof MarkdownView ? view.editor.getValue() : await this.app.vault.cachedRead(file);
      this.index.update(file.path, markdown);
      this.refreshInspector();
    } catch (error) { console.error(`Seshra: could not refresh ${file.path}`, error); }
  }

  private refreshInspector() {
    for (const leaf of this.app.workspace.getLeavesOfType(INSPECTOR_VIEW)) (leaf.view as RsInspector).refresh();
  }

  private openInspectorAtCursor() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    const line = view.editor.getCursor().line;
    const document = parseRs(view.editor.getValue(), view.file.path);
    const offset = view.editor.posToOffset(view.editor.getCursor());
    const referenceAtCursor = document.references.find(ref => offset >= ref.from && offset <= ref.to);
    if (referenceAtCursor) {
      void this.openInspector({ kind: referenceAtCursor.kind, key: referenceAtCursor.key });
      return;
    }
    const block = document.blocks.find(block => line >= block.startLine && line <= block.endLine);
    if (block && block.kind !== 'explanation') {
      void this.openInspector({ kind: block.kind, key: block.key });
      return;
    }
    new Notice('No RS object at the cursor.');
  }

  private showDiagnostics() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    this.index.update(view.file.path, view.editor.getValue());
    const warnings = this.index.getDiagnostics(view.file.path);
    new Notice(warnings.length ? warnings.slice(0, 8).join('\n') : 'No RS reference warnings in this note.', 8000);
  }
}
