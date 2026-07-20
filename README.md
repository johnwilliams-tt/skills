# grill-me-figma

A relentless interview skill for sharpening a **Figma design** plan or decision before you act on it.

It's a Figma-tailored derivative of Matt Pocock's [`grill-me`](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me): instead of quizzing you on things it could look up, it reads design facts straight from the Figma file via the Figma MCP server.

## What it does

Invoke `/grill-me-figma` and the agent interviews you one question at a time — walking each branch of the decision tree, recommending an answer for each — until you both reach a shared understanding. Only then does it act.

- **Reads facts instead of asking.** Pulls the current selection and file structure, variables and tokens, component-to-code mappings, and libraries from the Figma file (`get_metadata`, `get_design_context`, `get_variable_defs`, `get_code_connect_map`, `search_design_system`, `get_libraries`), and grabs a `get_screenshot` when a visual detail is in question.
- **Leaves the decisions to you.** Every judgment call is put to you, and it waits for your answer.
- **Makes no edits until you confirm.** Scoped to read-only Figma tools via `allowed-tools`, so it can't modify the file mid-interview.

## Requirements

- The [Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/) connected in your agent.
- An Agent-Skills-compatible harness (Claude Code, Codex, Cursor, …).

## Install

Copy [`productivity/grill-me-figma/`](./productivity/grill-me-figma/) into your agent's skills directory (e.g. `~/.claude/skills/`), then invoke it with `/grill-me-figma`.

## Credit

Derived from [`grill-me`](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) by [Matt Pocock](https://github.com/mattpocock), part of [mattpocock/skills](https://github.com/mattpocock/skills).
