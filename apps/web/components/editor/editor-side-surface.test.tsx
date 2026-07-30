import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorSideSurface } from "./editor-side-surface";

const noop = () => {};

describe("M7.1 editor side surface", () => {
  it("renders a docked complementary region without a sheet close control", () => {
    const html = renderToStaticMarkup(
      <EditorSideSurface
        id="editor-context-surface"
        side="right"
        label="Свойства · Комната"
        compact={false}
        open
        onClose={noop}
      >
        <div>Room inspector content</div>
      </EditorSideSurface>,
    );

    expect(html).toContain('id="editor-context-surface"');
    expect(html).toContain('aria-label="Свойства · Комната"');
    expect(html).toContain('data-side="right"');
    expect(html).toContain("is-docked");
    expect(html).not.toContain("Закрыть панель");
    expect(html).toContain("Room inspector content");
  });

  it("renders an explicit non-modal close control for an open compact sheet", () => {
    const html = renderToStaticMarkup(
      <EditorSideSurface
        id="editor-context-surface"
        side="right"
        label="Свойства · Предмет"
        compact
        open
        onClose={noop}
      >
        <div>Object inspector content</div>
      </EditorSideSurface>,
    );

    expect(html).toContain("is-compact");
    expect(html).toContain("is-open");
    expect(html).toContain('aria-modal="false"');
    expect(html).toContain("Свойства · Предмет");
    expect(html).toContain('aria-label="Закрыть панель"');
    expect(html).not.toContain("hidden");
  });

  it("keeps closed compact content mounted but removes it from traversal", () => {
    const html = renderToStaticMarkup(
      <EditorSideSurface
        id="editor-catalogue-surface"
        side="left"
        label="Мебель и техника"
        compact
        open={false}
        onClose={noop}
      >
        <div>Persistent catalogue content</div>
      </EditorSideSurface>,
    );

    expect(html).toContain("Persistent catalogue content");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("hidden");
    expect(html).toContain("inert");
    expect(html).toContain('data-side="left"');
  });

  it("uses the same shell anatomy on both sides", () => {
    const left = renderToStaticMarkup(
      <EditorSideSurface id="left" side="left" label="Каталог" compact open onClose={noop}><span>Left</span></EditorSideSurface>,
    );
    const right = renderToStaticMarkup(
      <EditorSideSurface id="right" side="right" label="Контекст" compact open onClose={noop}><span>Right</span></EditorSideSurface>,
    );

    expect(left).toContain("editor-side-surface-header");
    expect(right).toContain("editor-side-surface-header");
    expect(left).toContain("editor-side-surface-content");
    expect(right).toContain("editor-side-surface-content");
  });
});
