import { useMemo, useState } from "react";
import { useWebMCPTools } from "./mcp/useWebMCPTools";

// Phase 0 skeleton. One real tool, wired end to end, so the environment can be
// proven before any product code is written: does an agent actually discover
// and invoke a tool on the deployed origin?

type Invocation = { at: string; tool: string; input: string };

export default function App() {
  const [invocations, setInvocations] = useState<Invocation[]>([]);

  const tools = useMemo<WebMCPTool[]>(
    () => [
      {
        name: "get_workflow_state",
        title: "Get workflow state",
        description:
          "Report where the redaction workflow currently stands and which tools apply right now. Blindfold registers tools contextually, so the available surface changes as the workflow advances. Call this when a tool you expected is missing, or before planning a sequence of steps.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        async execute(input) {
          setInvocations((previous) => [
            {
              at: new Date().toLocaleTimeString(),
              tool: "get_workflow_state",
              input: JSON.stringify(input)
            },
            ...previous
          ]);
          return {
            stage: "no_document",
            summary:
              "No document is open. Blindfold is a redaction review tool: it opens a document locally, finds sensitive values, and applies redactions under human approval.",
            availableNext: ["get_workflow_state"],
            note: "Product tools are not built yet. This deployment verifies WebMCP wiring only."
          };
        }
      }
    ],
    []
  );

  const status = useWebMCPTools(tools);

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Blindfold</h1>
        <p className="mt-1 text-muted">
          An AI that redacts a document it is not allowed to read.
        </p>
      </header>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          WebMCP status
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">document.modelContext</dt>
          <dd className={status.supported ? "text-human" : "text-danger"}>
            {status.supported ? "available" : "not available in this browser"}
          </dd>
          <dt className="text-muted">Registered tools</dt>
          <dd>
            {status.registered.length > 0
              ? status.registered.join(", ")
              : "none"}
          </dd>
          {status.error ? (
            <>
              <dt className="text-muted">Error</dt>
              <dd className="text-danger">{status.error.message}</dd>
            </>
          ) : null}
        </dl>
        {!status.supported ? (
          <p className="mt-4 text-sm text-muted">
            Open this page in the ChatGPT desktop app browser, or in Chrome 149+
            with <code className="text-agent">chrome://flags/#enable-webmcp-testing</code>{" "}
            enabled.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Agent activity
        </h2>
        {invocations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing yet. Ask the agent: &ldquo;what can you do on this
            page?&rdquo;
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {invocations.map((invocation, index) => (
              <li key={index} className="flex gap-3">
                <span className="text-muted tabular-nums">
                  {invocation.at}
                </span>
                <span className="text-agent">{invocation.tool}</span>
                <span className="text-muted">{invocation.input}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
