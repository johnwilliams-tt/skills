# Skills

Agent skills authored to the [Agent Skills standard](https://agentskills.io) — small, composable `SKILL.md` files that work with any Agent-Skills-compatible harness (Claude Code, Codex, Cursor, the Figma MCP server, …).

The layout follows [mattpocock/skills](https://github.com/mattpocock/skills): each skill lives at `<category>/<name>/SKILL.md`, grouped by category, with a `README.md` per category.

## Reference

These split on one axis — who can invoke them. **User-invoked** skills are reachable only when you type them (e.g. `/grill-me-figma`); their job is to orchestrate. **Model-invoked** skills can be invoked by you _or_ reached for automatically by the agent when the task fits. A user-invoked skill may invoke model-invoked skills, but never another user-invoked one.

### Productivity

General workflow tools, not code-specific.

**User-invoked**

- **[grill-me-figma](./productivity/grill-me-figma/SKILL.md)** — A relentless interview to sharpen a Figma design plan or decision. Reads design facts from the Figma file rather than asking, and makes no edits until you confirm a shared understanding.
