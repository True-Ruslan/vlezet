import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(new URL("./recognition-panel.tsx", import.meta.url), "utf8");
const layerSource = readFileSync(new URL("./recognition-layer.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/recognition-panel.css", import.meta.url), "utf8");

describe("recognition AI review source contracts", () => {
  it("surfaces weak verification diagnostics without changing candidate decisions", () => {
    expect(panelSource).toContain('diagnostic.code === "weak-ai-verification-profile"');
    expect(panelSource).toContain('title="AI-проверка требует сравнения"');
    expect(panelSource).toContain("{aiVerificationWarning.message}");
    expect(panelSource).not.toContain("autoRevert");
  });

  it("keeps verification and omission-discovery actions explicit and separate", () => {
    expect(panelSource).toContain("Проверить локальный черновик с AI");
    expect(panelSource).toContain("Найти пропущенные двери и окна с AI");
    expect(panelSource).toContain("aiProposalDiscoveryAvailable");
  });

  it("uses reachable semantic source filters at narrow widths and with keyboard focus", () => {
    expect(panelSource).toContain('role="group"');
    expect(panelSource).toContain('aria-label="Фильтр источников распознавания"');
    expect(panelSource).toContain("aria-pressed");
    expect(styles).toContain(".recognition-source-filters");
    expect(styles).toContain("overflow-x: auto");
    expect(styles).toContain(".recognition-source-filter:focus-visible");
    expect(styles).toContain("@media (max-width: 420px)");
  });

  it("renders only eligible proposal geometry as dashed, labelled and independently selectable", () => {
    expect(layerSource).toContain('proposal.state !== "eligible"');
    expect(layerSource).toContain('proposal.geometry?.kind !== "opening"');
    expect(layerSource).toContain('text="Предложение AI"');
    expect(layerSource).toContain("dash={[10, 6]}");
    expect(layerSource).toContain("props.onSelect(proposal.id)");
  });
});
