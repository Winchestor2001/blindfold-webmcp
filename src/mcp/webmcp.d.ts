// WebMCP type declarations.
//
// Source of truth: docs/webmcp-api.md (vendored from the W3C Web Machine Learning
// CG spec and the Chrome imperative-API documentation). These types mirror the
// published WebIDL. Do not widen them from memory — see CLAUDE.md, Rule 1.

export {};

declare global {
  interface WebMCPToolAnnotations {
    /** Tool does not change state. Helps the agent decide when to ask the user. */
    readOnlyHint?: boolean;
    /** Output contains user-generated or external content. Flags it for scrutiny. */
    untrustedContentHint?: boolean;
  }

  interface WebMCPExecuteOptions {
    /** Aborted when the agent cancels the call, or the tool is unregistered. */
    signal: AbortSignal;
  }

  interface WebMCPTool {
    /** 1-128 chars, ASCII alphanumeric plus `_`, `-`, `.`. Chrome budget: 30. */
    name: string;
    title?: string;
    /** Required, non-empty. Chrome budget: 500 characters. */
    description: string;
    inputSchema?: object;
    annotations?: WebMCPToolAnnotations;
    /**
     * Returns any JSON-serialisable value; the browser stringifies it for the
     * agent. Do NOT wrap in `{ content: [...] }` — that is server-side MCP.
     */
    execute(
      input: Record<string, unknown>,
      options: WebMCPExecuteOptions
    ): Promise<unknown>;
  }

  interface WebMCPRegisterToolOptions {
    /** Abort to unregister. There is no `unregisterTool()`. */
    signal?: AbortSignal;
    /** Origins allowed to see this tool, beyond same-origin. */
    exposedTo?: string[];
  }

  interface WebMCPRegisteredTool {
    name: string;
    title?: string;
    description: string;
    inputSchema?: object;
    window: Window;
    origin: string;
    annotations?: WebMCPToolAnnotations;
  }

  interface WebMCPGetToolsOptions {
    fromOrigins?: string[];
  }

  interface WebMCPExecuteToolOptions {
    signal?: AbortSignal;
  }

  interface ModelContext extends EventTarget {
    registerTool(
      tool: WebMCPTool,
      options?: WebMCPRegisterToolOptions
    ): Promise<void>;
    getTools(options?: WebMCPGetToolsOptions): Promise<WebMCPRegisteredTool[]>;
    executeTool(
      tool: WebMCPRegisteredTool,
      input?: string | object,
      options?: WebMCPExecuteToolOptions
    ): Promise<string>;
    ontoolchange: ((this: ModelContext, ev: Event) => unknown) | null;
  }

  interface Document {
    /** Undefined when the browser has no WebMCP support or it is disabled. */
    readonly modelContext?: ModelContext;
  }
}
