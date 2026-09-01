# WebMCP API — vendored ground truth

> Verified 2026-08-27 against the sources listed at the bottom.
> This file is the ONLY permitted source of WebMCP API syntax in this repository.
> If something is not in this file, look it up in the live docs and add it here first.

## 0. The single most common mistake

WebMCP is **not** server-side MCP. Do not write:

```js
// WRONG — this is server-side MCP, it does not exist in the browser
server.tool("name", schema, async (args) => ({ content: [{ type: "text", text: "..." }] }));
new McpServer(...); StdioServerTransport; @modelcontextprotocol/sdk
```

There is no SDK, no transport, no server object. WebMCP is a browser API on `document`.

## 1. Entry point

```js
document.modelContext   // ModelContext, [SecureContext, SameObject]
```

`navigator.modelContext` is **deprecated as of Chrome 150**. Always use `document.modelContext`.

Feature detection:

```js
if (typeof document.modelContext?.registerTool === "function") { /* ... */ }
```

## 2. WebIDL (from the W3C Web Machine Learning CG spec)

```webidl
[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(
    ModelContextTool tool,
    optional ModelContextRegisterToolOptions options = {}
  );
  Promise<sequence<RegisteredTool>> getTools(
    optional ModelContextGetToolOptions options = {}
  );
  Promise<DOMString> executeTool(
    RegisteredTool tool,
    optional object inputObject = {},
    optional ModelContextExecuteToolOptions options = {}
  );

  attribute EventHandler ontoolchange;
};

partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

dictionary ModelContextTool {
  required DOMString name;
  USVString title;
  required DOMString description;
  object inputSchema;
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};

dictionary ToolAnnotations {
  boolean readOnlyHint = false;
  boolean untrustedContentHint = false;
};

callback ToolExecuteCallback = Promise<any> (
  object inputObject,
  ToolExecuteCallbackOptions options
);

dictionary ToolExecuteCallbackOptions {
  required AbortSignal signal;
};

dictionary ModelContextRegisterToolOptions {
  sequence<USVString> exposedTo;
  AbortSignal signal;
};

dictionary ModelContextGetToolOptions {
  sequence<USVString> fromOrigins;
};

dictionary ModelContextExecuteToolOptions {
  AbortSignal signal;
};

dictionary RegisteredTool {
  required DOMString name;
  DOMString title;
  required DOMString description;
  object inputSchema;
  required Window window;
  required USVString origin;
  ToolAnnotations annotations;
};
```

## 3. Registering a tool (verbatim shape from Chrome docs)

```js
await document.modelContext.registerTool({
  name: 'toggle_layer',
  description: 'Control pizza layers (sauce, cheese). Use "add", "remove", or "toggle".',
  inputSchema: {
    type: 'object',
    properties: {
      layer: { type: 'string', enum: ['sauce-layer', 'cheese-layer'] },
      action: { type: 'string', enum: ['add', 'remove', 'toggle'] },
    },
    required: ['layer'],
  },
  execute: async ({ layer, action }) => {
    await toggleLayer(layer, action);
    return `Performed ${action || 'toggle'} on layer: ${layer}`;
  },
});
```

### What `execute` returns

`Promise<any>`. A plain string is fine. An object is fine — it is stringified.
`executeTool()` resolves to a `DOMString`, so whatever you return reaches the agent as text.

Returning an object is the documented ChatGPT pattern:

```js
execute: async () => ({ title: document.title }),
```

**Do NOT wrap in `{ content: [{ type: 'text', ... }] }`.** That is server-side MCP.

### Cancellation — second argument

```js
execute: async ({ url, priority }, { signal }) => {
  const response = await fetch(url, { priority, signal });
  // ...
  return 'Success';
},
```

## 4. Unregistering — AbortController, not a method

There is no `unregisterTool()`. You pass a signal at registration and abort it.

```js
const controller = new AbortController();
await document.modelContext.registerTool(addTodoTool, { signal: controller.signal });

// Unregister the tool later...
controller.abort();
```

## 5. Discovery and manual execution

```js
const [tool] = await document.modelContext.getTools();
console.log(tool);
// {
//   annotations: { readOnlyHint: false, untrustedContentHint: true },
//   description: "Add a new item to the to-do list",
//   inputSchema: {"type":"object","properties":{…}},
//   name: "addTodo",
//   origin: "https://example.com",
//   title: ""
//   window: Window {window: Window, self: Window, …},
// }

const sameOriginTools = await document.modelContext.getTools();
const allTools = await document.modelContext.getTools({ fromOrigins: ['https://partner.org'] });

const result = await document.modelContext.executeTool(tool, '{"text": "Buy milk"}');
// 'Added to-do: Buy milk'
```

## 6. Events

```js
document.modelContext.addEventListener("toolchange", (event) => {
  // Tools have changed (registered, unregistered, or accessibility changed).
});
```

## 7. Cross-origin exposure and permissions policy

```js
await document.modelContext.registerTool(tool, {
  exposedTo: ['https://trusted.com', 'https://example.com']
});
```

```html
<iframe src="https://example.com" allow="tools"></iframe>
```

Policy-controlled feature name: `"tools"`. Default allowlist: `['self']`.

## 8. Errors thrown by registerTool

| Error | Cause |
|---|---|
| `InvalidStateError` | name already registered, empty name/description, invalid name format, document not fully active |
| `SecurityError` | invalid origins, security context requirements unmet |
| `NotAllowedError` | document lacks the `tools` permissions-policy feature |

Name constraints: **1–128 characters, ASCII alphanumeric, underscore, hyphen, period only.**
Description must be non-empty.

## 9. Chrome character budgets

| Item | Budget |
|---|---|
| Tool description | 500 characters |
| Parameter description | 150 characters |
| Tool / parameter name | 30 characters |
| Tool output | 1.5K characters |

## 10. Chrome best practices (condensed, authoritative)

- One tool = one function. Atomic, composable, distinct. No overlapping purposes.
- Name the outcome precisely: `create_event` (does it) vs `start_event_creation` (opens a form).
- Describe capabilities positively. Not "Don't use this for weather" but what it *does*.
- Accept raw user input. Never ask the agent to do maths or transform strings.
- Natural-language values over opaque IDs: `shipping: "Express"`, not `shipping_id: 1`.
- Every parameter gets a type and a description. Reduces hallucination.
- Validate strictly in code, loosely in schema — schema constraints are not guaranteed.
- Return descriptive errors so the model can self-correct and retry.
- Prefer static registration; use dynamic registration deliberately, where page state warrants it.
- More tools = more context and slower selection. Do not pad the surface.

## 11. Security (from the Chrome "secure tools" guide)

- Indirect prompt injection is the primary threat. Safety cannot be guaranteed inside an LLM.
- `untrustedContentHint: true` — set on any tool returning user-generated or external content.
  Signals to the agent that the data needs heightened scrutiny.
- `readOnlyHint: true` — set on non-state-changing tools so agents can decide when to ask
  the user for confirmation.
- `exposedTo` — only expose read-only tools to origins you would share the data with; only
  expose write tools to origins you trust to act for the user.
- The spec draft mentions `requestUserInteraction()` for requesting user input during tool
  execution, but it is not documented with an example and is not relied upon here. This project
  implements its own promise-suspending confirmation gates instead.

## 12. Runtime availability

| Environment | How |
|---|---|
| Chrome 149–156 | `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch |
| Chrome 149–156, real users | Origin trial token via `<meta http-equiv="origin-trial" content="TOKEN">` or `Origin-Trial:` response header |
| ChatGPT desktop in-app browser | Works natively, no token. **Requires GPT-5.6 Sol or Terra.** Not Luna. Not Enterprise/Edu workspaces. |

Note: subdomain-matching origin trial tokens are **not issued** for origins on the Public
Suffix List, which includes `workers.dev`. An exact-origin token is issued and works —
registered 1 September 2026 for `https://blindfold.blindfold.workers.dev`, expires
2026-11-17, served from the meta tag in `index.html`. Leave *Match subdomains* unticked.

## 13. Debugging

**DevTools → Application → WebMCP.** Two sections:
- *Available Tools* — names, descriptions, invocation counters.
- *Invoked Tools* — persistent record with status, input, output.

Click a tool → fill parameters → **Run tool**. This executes the tool without an agent and is
the fastest way to verify logic.

## 14. Testing with a real agent

The flag alone does not put an agent in the browser. Chrome's own documentation points at a
separate extension for this:

> Install the Model Context Tool Inspector Extension to experiment with an agent and see how
> WebMCP tools work in live demos or your own applications.

**WebMCP — Model Context Tool Inspector**, by Francois Beaufort (Google Ireland, Ltd.).
Requires Chrome 150.0.7861.0 or later with `chrome://flags/#enable-webmcp-testing` enabled.
Manual tool execution needs nothing further. **Agent mode needs a Gemini API key**, set through
the extension's own "Set Gemini API key" button; until one is set, the Send button stays
disabled. Keys are free from https://aistudio.google.com/apikey and stay in the extension's
local storage. Chrome's own doc omits this, which is why it is written down here.

- Install from the Chrome Web Store, or `Load unpacked` from source after `npm install`.
- Click the extension's action icon in the toolbar. It opens in the **Side Panel**.
- *Manual mode* — pick a tool from the dropdown, enter arguments as JSON in the text area,
  **Execute Tool**. The result appears in the side panel.
- *Agent mode* — talk to it in natural language, "to see if it can correctly identify and
  invoke the appropriate WebMCP tools". Prompts go to `gemini-3-flash-preview` by default.
  This is separate from the Gemini in Chrome features.

Chrome's docs carry a warning about the extension: it "does not implement production-level
security boundaries" and should not be pointed at untrusted websites.

This is the surface that satisfies Rule 3 step 2. The DevTools panel in section 13 runs a tool
without an agent and proves the logic; the extension is what shows whether a description is
written well enough for an agent to pick the right tool from a natural phrasing.

---

## Sources

| What | URL |
|---|---|
| Specification (WebIDL) | https://webmachinelearning.github.io/webmcp/ |
| Imperative API | https://developer.chrome.com/docs/ai/webmcp/imperative-api |
| Best practices | https://developer.chrome.com/docs/ai/webmcp/best-practices |
| Secure tools | https://developer.chrome.com/docs/ai/webmcp/secure-tools |
| Use cases | https://developer.chrome.com/docs/ai/webmcp/use-cases |
| DevTools panel | https://developer.chrome.com/docs/devtools/application/webmcp |
| Origin trial | https://developer.chrome.com/blog/ai-webmcp-origin-trial |
| ChatGPT in-app browser | https://learn.chatgpt.com/docs/webmcp |
| Model Context Tool Inspector (extension) | https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd |
| Model Context Tool Inspector (source) | https://github.com/beaufortfrancois/model-context-tool-inspector |
| WebMCP demos | https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos |
| Reference template | https://github.com/cloudflare/agents/tree/main/examples/webmcp-react |
