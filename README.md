# Seshra

Seshra is a Markdown-first RS v0.2 plugin for Obsidian. It highlights explicit Research Shorthand syntax in Live Preview and lets you inspect entities, claims, and evidence without changing the note text. The vision and syntax examples are in [AGENTS.md](AGENTS.md).

Repository: [jasonshelter0/obsidian-seshra](https://github.com/jasonshelter0/obsidian-seshra).

## Development

Use Node.js 22 or newer. Run `npm install`, then `npm run build`. Obsidian loads `manifest.json`, `main.js`, and `styles.css` from this directory. Use `npm run dev` for a watch build and reload the plugin in Obsidian after changes. Run `npm test` for parser and index tests.

## Try the first version

1. Enable Seshra in Obsidian's Community plugins settings.
2. Paste an entity, claim, and evidence into a note:

   ```markdown
   [TASK] SIRST
   :: Detect small infrared targets.

   [METHOD] ALCNet
   :: Local contrast with bottom-up attention.
   | task:[[SIRST]]

   C1+:
   ALCNet addresses [[SIRST]].
   | sup:E1
   | @self:synthesis

   E1:
   The evaluation reports improved detection.
   | @Paper23
   ```

3. In Live Preview, Alt-click an entity heading or `[[entity]]` to inspect it. Alt-click `C1` or `E1` to inspect reasoning; Alt-click an evidence ID in a `sup:` relation to jump to its definition. Use the command **Inspect RS at cursor** as a keyboard alternative.
4. Use **Check RS references in current note** for duplicate reasoning IDs and missing relation targets.

The inspector reads Markdown and follows vault-wide definitions and mentions. It does not write hidden research data. Graph editing, AI, and visual write-back are future phases.
