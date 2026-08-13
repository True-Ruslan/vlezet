export type RoomCanvasLabelBox = Readonly<{
  y: number;
  height: number;
}>;

export type RoomCanvasLabelLayout =
  | Readonly<{
      hidden: true;
      textWidthPx: 0;
      totalHeightPx: 0;
      nameLines: 1;
      showArea: false;
      showDimensions: false;
      nameBox: null;
      areaBox: null;
      dimensionsBox: null;
    }>
  | Readonly<{
      hidden: false;
      textWidthPx: number;
      totalHeightPx: number;
      nameLines: 1 | 2;
      showArea: boolean;
      showDimensions: boolean;
      nameBox: RoomCanvasLabelBox;
      areaBox: RoomCanvasLabelBox | null;
      dimensionsBox: RoomCanvasLabelBox | null;
    }>;

export type RoomCanvasLabelLayoutInput = Readonly<{
  widthPx: number;
  heightPx: number;
  hasDimensions?: boolean;
}>;

const HORIZONTAL_PADDING_PX = 7;
const VERTICAL_PADDING_PX = 4;
const MAX_TEXT_WIDTH_PX = 200;
const MIN_TEXT_WIDTH_PX = 48;
const LINE_HEIGHT_PX = 15;
const BLOCK_GAP_PX = 2;

function visibleLayout(
  textWidthPx: number,
  nameLines: 1 | 2,
  showArea: boolean,
  showDimensions: boolean,
): RoomCanvasLabelLayout {
  let y = 0;
  const nameBox: RoomCanvasLabelBox = { y, height: LINE_HEIGHT_PX * nameLines };
  y += nameBox.height;

  const areaBox = showArea
    ? (() => {
        y += BLOCK_GAP_PX;
        const box: RoomCanvasLabelBox = { y, height: LINE_HEIGHT_PX };
        y += box.height;
        return box;
      })()
    : null;

  const dimensionsBox = showDimensions
    ? (() => {
        y += BLOCK_GAP_PX;
        const box: RoomCanvasLabelBox = { y, height: LINE_HEIGHT_PX };
        y += box.height;
        return box;
      })()
    : null;

  return {
    hidden: false,
    textWidthPx,
    totalHeightPx: y,
    nameLines,
    showArea,
    showDimensions,
    nameBox,
    areaBox,
    dimensionsBox,
  };
}

export function deriveRoomCanvasLabelLayout({
  widthPx,
  heightPx,
  hasDimensions = true,
}: RoomCanvasLabelLayoutInput): RoomCanvasLabelLayout {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx)) {
    return hiddenLayout();
  }

  const textWidthPx = Math.min(MAX_TEXT_WIDTH_PX, Math.max(0, widthPx - HORIZONTAL_PADDING_PX * 2));
  const safeHeightPx = Math.max(0, heightPx - VERTICAL_PADDING_PX * 2);
  if (textWidthPx < MIN_TEXT_WIDTH_PX || safeHeightPx < LINE_HEIGHT_PX) {
    return hiddenLayout();
  }

  const candidates: readonly RoomCanvasLabelLayout[] = [
    ...(hasDimensions ? [visibleLayout(textWidthPx, 2, true, true)] : []),
    visibleLayout(textWidthPx, 2, true, false),
    visibleLayout(textWidthPx, 1, true, false),
    visibleLayout(textWidthPx, 1, false, false),
  ];

  return candidates.find((candidate) => !candidate.hidden && candidate.totalHeightPx <= safeHeightPx) ?? hiddenLayout();
}

function hiddenLayout(): RoomCanvasLabelLayout {
  return {
    hidden: true,
    textWidthPx: 0,
    totalHeightPx: 0,
    nameLines: 1,
    showArea: false,
    showDimensions: false,
    nameBox: null,
    areaBox: null,
    dimensionsBox: null,
  };
}
