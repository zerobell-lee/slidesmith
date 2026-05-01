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
- `/slidesmith:theme` — manage themes (`list`, `add`, `update`, `remove`, `info`).
- `/slidesmith:doctor` — verify the environment.

## Themes

Bundled: `default`, `midnight-tech`, `editorial`. List available themes:

```
/slidesmith:theme list
```

Add a third-party theme:

```
/slidesmith:theme add https://github.com/<user>/<repo>
```

## Documentation

- Design spec: `docs/superpowers/specs/2026-04-30-slidesmith-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-30-slidesmith.md`

## License

Follows the `LICENSE` file at the repository root.
