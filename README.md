# slidesmith

A Marp-based Claude Code plugin. Generates presentations (PDF/HTML/PPTX) from natural-language input.

## Installation

1. **Dependencies**:
   ```bash
   npm i -g @marp-team/marp-cli
   npm i -g @mermaid-js/mermaid-cli   # if you use mermaid
   ```

2. **Install plugin dependencies**:
   ```bash
   cd <plugin-root>/scripts && npm install
   ```

3. **Verify your environment with doctor**:
   ```
   /slidesmith:doctor
   ```

## Quick start

```
# 1. Create a new project
/slidesmith:new my-deck --theme midnight-tech --lang ko

# 2. (Optional) Refine the spec interactively with Claude
/slidesmith:plan

# 3. Build in one shot
/slidesmith:build

# Output: my-deck/build/deck.pdf  (HTML version + assets in my-deck/build/html/)
```

## Commands

The plugin exposes 5 slash commands:

- `/slidesmith:new` — bootstrap a new project directory.
- `/slidesmith:plan` — interactive brainstorm; Claude asks questions and updates `blueprint.md` (the spec). Does NOT generate slides.
- `/slidesmith:build` — runs the full pipeline (draft → prerender → export). Use `--from <output|prerendered>` or `--to <output|prerendered>` for partial runs.
- `/slidesmith:theme` — manage themes (`list`, `info`, `add`, `update`, `remove`, `preview`, `create`).
- `/slidesmith:doctor` — verify the environment.

## Themes

Bundled themes ship with the plugin. Each one has a pre-rendered preview under `gallery/<theme>/deck.html` that you can open directly on GitHub or locally.

| Theme | Preview | Description |
|---|---|---|
| `default` | [gallery/default/deck.html](gallery/default/deck.html) | Clean, neutral, light. Works for any topic. |
| `midnight-tech` | [gallery/midnight-tech/deck.html](gallery/midnight-tech/deck.html) | Dark theme tuned for code-heavy technical talks. |
| `editorial` | [gallery/editorial/deck.html](gallery/editorial/deck.html) | Serif, text-driven theme for narrative reports and book-style decks. |

Manage themes via the slash command:

```
/slidesmith:theme list                 # show all installed themes
/slidesmith:theme info <name>          # show theme metadata
/slidesmith:theme preview <name>       # print path to a rendered preview HTML
/slidesmith:theme add <git-url>        # install a third-party theme
/slidesmith:theme create <name>        # interactive: design a new theme via Q&A + preview iteration
```

To regenerate the gallery after editing a bundled theme:

```bash
cd scripts && SLIDESMITH_PLUGIN_DIR="$(pwd)/.." npx tsx src/cli.ts gallery
```

## Documentation

- Design spec: `docs/superpowers/specs/2026-04-30-slidesmith-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-30-slidesmith.md`

## License

Follows the `LICENSE` file at the repository root.
