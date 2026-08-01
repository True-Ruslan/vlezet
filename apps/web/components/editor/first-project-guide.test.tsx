import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deriveFirstProjectProgress } from "./first-project-progress";
import { FirstProjectGuide } from "./first-project-guide";

function render(wallCount: number, roomCount: number) {
  return renderToStaticMarkup(
    <FirstProjectGuide
      progress={deriveFirstProjectProgress({ wallCount, roomCount })}
      onPrimaryAction={() => {}}
      onDismiss={() => {}}
    />,
  );
}

describe("M7.5 first-project guide", () => {
  it("renders the empty-project action without a blocking dialog", () => {
    const html = render(0, 0);
    expect(html).toContain('data-first-project-phase="empty"');
    expect(html).toContain("Первый план");
    expect(html).toContain("Начать со стены");
    expect(html).toContain('aria-label="Скрыть подсказку первого проекта"');
    expect(html).not.toContain('role="dialog"');
  });

  it("explains that an open contour is not a room", () => {
    const html = render(3, 0);
    expect(html).toContain('data-first-project-phase="drawing"');
    expect(html).toContain("Контур ещё не замкнут");
    expect(html).toContain("Продолжить рисование");
    expect(html).toContain('data-current-step="closed-room"');
  });

  it("acknowledges authoritative room success and offers review", () => {
    const html = render(4, 1);
    expect(html).toContain('data-first-project-phase="room-created"');
    expect(html).toContain("Первая комната готова");
    expect(html).toContain("Открыть комнату");
    expect(html).toContain("Завершить");
    expect(html).toContain('data-step-state="complete"');
  });
});
