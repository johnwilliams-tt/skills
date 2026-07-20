---
name: grill-me-figma
description: A relentless interview to sharpen a Figma design plan or decision.
disable-model-invocation: true
compatibility: Requires the Figma MCP server.
metadata:
  mcp-server: figma
allowed-tools: get_metadata, get_design_context, get_screenshot, get_variable_defs, get_code_connect_map, get_libraries, search_design_system
---

Interview me relentlessly about every aspect of this design plan, decision, or exploration until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask one question at a time, waiting for my feedback before continuing — a batch of questions at once is bewildering.

If a *fact* can be read from the Figma file, read it rather than asking me: the current selection and file structure (`get_metadata`, `get_design_context`), the defined variables and tokens (`get_variable_defs`), component-to-code mappings (`get_code_connect_map`), and the available libraries (`search_design_system`, `get_libraries`) — and pull a `get_screenshot` when a visual detail is in question. The *decisions* are mine — put each one to me and wait for my answer.

The interview is done when I confirm we have reached a shared understanding. Only read while we grill — make no edits to the file until then.
