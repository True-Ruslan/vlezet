import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitStatusBadge, fitStatusPresentation } from "./fit-status-badge";

describe("object fit status presentation", () => {
  it("maps authoritative fit states to canonical user copy and semantic tones", () => {
    expect(fitStatusPresentation("fits")).toEqual({ label: "Влезает", tone: "success" });
    expect(fitStatusPresentation("tight")).toEqual({ label: "Влезает, но тесно", tone: "warning" });
    expect(fitStatusPresentation("blocked")).toEqual({ label: "Не влезает", tone: "danger" });
  });

  it("renders shared textual badge anatomy", () => {
    const html = renderToStaticMarkup(<FitStatusBadge status="tight" />);
    expect(html).toContain('class="ui-badge ui-badge-warning fit-status-badge"');
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain("Влезает, но тесно");
  });
});
