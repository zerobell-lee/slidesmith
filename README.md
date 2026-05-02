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

Bundled themes ship with the plugin. Each preview below is the title slide of the theme's standard showcase sample. For all 7 slides as a flippable HTML deck or to see how every Markdown element renders, follow the deck link.

### `default`

Clean, neutral, light. Works for any topic.

[![default](gallery/default/slide.001.png)](gallery/default/deck.html)

### `midnight-tech`

Dark theme tuned for code-heavy technical talks. Editor-window code blocks, electric-violet accents.

[![midnight-tech](gallery/midnight-tech/slide.001.png)](gallery/midnight-tech/deck.html)

### `editorial`

Serif, text-driven theme for narrative reports and book-style decks.

[![editorial](gallery/editorial/slide.001.png)](gallery/editorial/deck.html)

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
