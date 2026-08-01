import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorProjectScope, useEditorProjectId } from "./editor-project-scope";

function Probe() {
  return <span data-project-id={useEditorProjectId()} />;
}

describe("M7.5 editor runtime project scope", () => {
  it("provides project identity without writing it into the document", () => {
    const html = renderToStaticMarkup(
      <EditorProjectScope projectId="project-1"><Probe /></EditorProjectScope>,
    );
    expect(html).toContain('data-project-id="project-1"');
  });
});
