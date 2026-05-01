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

# 2. Edit blueprint.md (or use the sample as-is)

# 3. Build in one shot
/slidesmith:build

# Output: my-deck/build/deck.pdf
```

## Step-by-step build

```
/slidesmith:plan         # blueprint → output.md
/slidesmith:prerender    # convert placeholders → build/.cache/prerendered.md
/slidesmith:export       # marp-cli → build/deck.pdf
```

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
