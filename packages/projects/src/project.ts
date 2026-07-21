import {
  createEmptyDocument,
  createPlacedObject,
  createVertex,
  createWall,
  migrateDocument,
  type ObjectCategory,
  type Opening,
  type Point2,
  type RoomAnnotation,
  type VlezetDocument,
  type VlezetDocumentV1,
  type VlezetDocumentV2,
  type VlezetDocumentV3,
  type V1Wall,
} from "@vlezet/domain";

export const PROJECT_STORAGE_VERSION = 2 as const;
export const MAX_PROJECT_NAME_LENGTH = 80;
export const MIN_PROJECT_SCALE = 0.01;
export const MAX_PROJECT_SCALE = 2;
export const MIN_REFERENCE_SCALE = 0.05;
export const MAX_REFERENCE_SCALE = 100;

export type ProjectViewport = Readonly<{
  offsetX: number;
  offsetY: number;
  pixelsPerMillimeter: number;
}>;

export type ProjectUiState = Readonly<{
  furnitureCatalogOpen: boolean;
  referencePanelOpen: boolean;
}>;

export type ReferenceAlignment = "none" | "horizontal" | "vertical";

export type ReferencePlanSource =
  | Readonly<{ kind: "image"; originalMimeType: "image/png" | "image/jpeg" }>
  | Readonly<{ kind: "pdf"; pageNumber: number; pageCount: number }>;

export type ReferencePlanTransform = Readonly<{
  originWorld: Point2;
  millimetersPerPixel: number;
  rotationDeg: number;
}>;

export type ReferencePlanCalibration = Readonly<{
  pointA: Point2;
  pointB: Point2;
  knownLengthMm: number;
  alignment: ReferenceAlignment;
}>;

export type ReferencePlanDisplay = Readonly<{
  visible: boolean;
  opacity: number;
  locked: boolean;
}>;

export type ReferencePlan = Readonly<{
  assetId: string;
  source: ReferencePlanSource;
  widthPx: number;
  heightPx: number;
  transform: ReferencePlanTransform;
  calibration: ReferencePlanCalibration;
  display: ReferencePlanDisplay;
}>;

export type VlezetProjectRecord = Readonly<{
  storageVersion: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  document: VlezetDocument;
  viewport: ProjectViewport;
  ui: ProjectUiState;
  referencePlan: ReferencePlan | null;
}>;

export const DEFAULT_PROJECT_VIEWPORT: ProjectViewport = Object.freeze({
  offsetX: 140,
  offsetY: 140,
  pixelsPerMillimeter: 0.12,
});

export const DEFAULT_PROJECT_UI: ProjectUiState = Object.freeze({
  furnitureCatalogOpen: true,
  referencePanelOpen: false,
});

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectValidationError(`${label} содержит некорректные данные.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new ProjectValidationError(`${label} должен быть списком.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new ProjectValidationError(`${label} должен быть строкой.`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProjectValidationError(`${label} должен быть конечным числом.`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const number = finite(value, label);
  if (number <= 0) throw new ProjectValidationError(`${label} должен быть больше нуля.`);
  return number;
}

function bounded(value: unknown, min: number, max: number, label: string): number {
  const number = finite(value, label);
  if (number < min || number > max) {
    throw new ProjectValidationError(`${label} должен быть от ${min} до ${max}.`);
  }
  return number;
}

function isoTimestamp(value: unknown, label: string): string {
  const timestamp = text(value, label);
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw new ProjectValidationError(`${label} содержит некорректную дату.`);
  }
  return timestamp;
}

function point(value: unknown, label: string): Point2 {
  const input = record(value, label);
  return { x: finite(input.x, `${label}.x`), y: finite(input.y, `${label}.y`) };
}

export function normalizeProjectName(value: unknown): string {
  const name = text(value, "Название проекта").trim();
  if (!name) throw new ProjectValidationError("Название проекта не может быть пустым.");
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new ProjectValidationError(`Название проекта не может быть длиннее ${MAX_PROJECT_NAME_LENGTH} символов.`);
  }
  return name;
}

export function validateProjectViewport(value: unknown): ProjectViewport {
  const input = record(value, "Положение плана");
  const scale = bounded(input.pixelsPerMillimeter, MIN_PROJECT_SCALE, MAX_PROJECT_SCALE, "Масштаб");
  return {
    offsetX: finite(input.offsetX, "Смещение X"),
    offsetY: finite(input.offsetY, "Смещение Y"),
    pixelsPerMillimeter: scale,
  };
}

export function validateProjectUi(value: unknown): ProjectUiState {
  const input = record(value, "Настройки интерфейса");
  if (typeof input.furnitureCatalogOpen !== "boolean") {
    throw new ProjectValidationError("Состояние каталога мебели должно быть логическим значением.");
  }
  if (input.referencePanelOpen !== undefined && typeof input.referencePanelOpen !== "boolean") {
    throw new ProjectValidationError("Состояние панели подложки должно быть логическим значением.");
  }
  return {
    furnitureCatalogOpen: input.furnitureCatalogOpen,
    referencePanelOpen: input.referencePanelOpen ?? false,
  };
}

function validateReferenceSource(value: unknown): ReferencePlanSource {
  const input = record(value, "Источник подложки");
  if (input.kind === "image") {
    if (input.originalMimeType !== "image/png" && input.originalMimeType !== "image/jpeg") {
      throw new ProjectValidationError("Формат исходного изображения не поддерживается.");
    }
    return { kind: "image", originalMimeType: input.originalMimeType };
  }
  if (input.kind === "pdf") {
    const pageNumber = positive(input.pageNumber, "Номер страницы PDF");
    const pageCount = positive(input.pageCount, "Количество страниц PDF");
    if (!Number.isInteger(pageNumber) || !Number.isInteger(pageCount) || pageNumber > pageCount) {
      throw new ProjectValidationError("Страница PDF содержит некорректные данные.");
    }
    return { kind: "pdf", pageNumber, pageCount };
  }
  throw new ProjectValidationError("Тип источника подложки не поддерживается.");
}

export function validateReferencePlan(value: unknown): ReferencePlan {
  const input = record(value, "Подложка");
  const assetId = text(input.assetId, "Идентификатор подложки").trim();
  if (!assetId) throw new ProjectValidationError("Идентификатор подложки не может быть пустым.");
  const transform = record(input.transform, "Преобразование подложки");
  const calibration = record(input.calibration, "Калибровка подложки");
  const display = record(input.display, "Отображение подложки");
  if (calibration.alignment !== "none" && calibration.alignment !== "horizontal" && calibration.alignment !== "vertical") {
    throw new ProjectValidationError("Тип выравнивания подложки не поддерживается.");
  }
  if (typeof display.visible !== "boolean" || typeof display.locked !== "boolean") {
    throw new ProjectValidationError("Состояние подложки должно быть логическим значением.");
  }
  return {
    assetId,
    source: validateReferenceSource(input.source),
    widthPx: positive(input.widthPx, "Ширина подложки"),
    heightPx: positive(input.heightPx, "Высота подложки"),
    transform: {
      originWorld: point(transform.originWorld, "Начало подложки"),
      millimetersPerPixel: bounded(transform.millimetersPerPixel, MIN_REFERENCE_SCALE, MAX_REFERENCE_SCALE, "Масштаб подложки"),
      rotationDeg: finite(transform.rotationDeg, "Поворот подложки"),
    },
    calibration: {
      pointA: point(calibration.pointA, "Первая точка калибровки"),
      pointB: point(calibration.pointB, "Вторая точка калибровки"),
      knownLengthMm: bounded(calibration.knownLengthMm, 100, 100_000, "Известная длина"),
      alignment: calibration.alignment,
    },
    display: {
      visible: display.visible,
      opacity: bounded(display.opacity, 0.05, 1, "Прозрачность подложки"),
      locked: display.locked,
    },
  };
}

function parseV1Wall(value: unknown): V1Wall {
  const input = record(value, "Стена");
  const id = text(input.id, "Идентификатор стены").trim();
  if (!id) throw new ProjectValidationError("Идентификатор стены не может быть пустым.");
  return { id, start: point(input.start, "Начало стены"), end: point(input.end, "Конец стены"), thickness: positive(input.thickness, "Толщина стены") };
}

function parseOpening(value: unknown): Opening {
  const input = record(value, "Проём");
  const kind = input.kind;
  if (kind !== "door" && kind !== "window") throw new ProjectValidationError("Тип проёма не поддерживается.");
  const base = {
    id: text(input.id, "Идентификатор проёма").trim(),
    wallId: text(input.wallId, "Стена проёма").trim(),
    kind,
    offset: finite(input.offset, "Смещение проёма"),
    width: positive(input.width, "Ширина проёма"),
  } as const;
  if (!base.id || !base.wallId) throw new ProjectValidationError("Проём должен ссылаться на существующую стену.");
  if (kind !== "door" || input.doorSwing === undefined) return base;
  const swing = record(input.doorSwing, "Открывание двери");
  if (swing.hinge !== "start" && swing.hinge !== "end") throw new ProjectValidationError("Некорректная сторона петли двери.");
  if (swing.side !== "left" && swing.side !== "right") throw new ProjectValidationError("Некорректное направление двери.");
  return { ...base, doorSwing: { hinge: swing.hinge, side: swing.side } };
}

function parseRoomAnnotation(value: unknown): RoomAnnotation {
  const input = record(value, "Название комнаты");
  const id = text(input.id, "Идентификатор названия комнаты").trim();
  const name = text(input.name, "Название комнаты").trim();
  if (!id || !name) throw new ProjectValidationError("Название комнаты содержит пустые данные.");
  return { id, name, anchor: point(input.anchor, "Точка названия комнаты") };
}

const OBJECT_CATEGORIES = new Set<ObjectCategory>([
  "sleep", "seating", "storage", "table", "chair", "kitchen", "appliance", "custom",
]);

function parsePlacedObject(value: unknown) {
  const input = record(value, "Предмет");
  if (!OBJECT_CATEGORIES.has(input.category as ObjectCategory)) throw new ProjectValidationError("Категория предмета не поддерживается.");
  const clearance = record(input.clearance, "Зона использования предмета");
  try {
    return createPlacedObject({
      id: text(input.id, "Идентификатор предмета"),
      presetId: input.presetId === null || input.presetId === undefined ? null : text(input.presetId, "Пресет предмета"),
      name: text(input.name, "Название предмета"),
      category: input.category as ObjectCategory,
      position: point(input.position, "Положение предмета"),
      width: finite(input.width, "Ширина предмета"),
      depth: finite(input.depth, "Глубина предмета"),
      ...(input.height === undefined ? {} : { height: finite(input.height, "Высота предмета") }),
      rotationDeg: finite(input.rotationDeg, "Угол предмета"),
      clearance: {
        front: finite(clearance.front, "Передний зазор"), right: finite(clearance.right, "Правый зазор"),
        back: finite(clearance.back, "Задний зазор"), left: finite(clearance.left, "Левый зазор"),
      },
    });
  } catch {
    throw new ProjectValidationError("Предмет содержит некорректные размеры или координаты.");
  }
}

function parseShell(value: Record<string, unknown>): Omit<VlezetDocumentV2, "schemaVersion"> {
  const vertices = array(value.vertices, "Вершины").map((entry) => {
    const input = record(entry, "Вершина");
    try { return createVertex(text(input.id, "Идентификатор вершины").trim(), point(input.position, "Положение вершины")); }
    catch { throw new ProjectValidationError("Вершина содержит некорректные данные."); }
  });
  const walls = array(value.walls, "Стены").map((entry) => {
    const input = record(entry, "Стена");
    try {
      return createWall({
        id: text(input.id, "Идентификатор стены").trim(),
        startVertexId: text(input.startVertexId, "Начальная вершина").trim(),
        endVertexId: text(input.endVertexId, "Конечная вершина").trim(),
        junctionVertexIds: array(input.junctionVertexIds, "Соединения стены").map((item) => text(item, "Идентификатор соединения")),
        thickness: finite(input.thickness, "Толщина стены"),
      });
    } catch { throw new ProjectValidationError("Стена содержит некорректные данные."); }
  });
  return { vertices, walls, openings: array(value.openings, "Проёмы").map(parseOpening), roomAnnotations: array(value.roomAnnotations, "Названия комнат").map(parseRoomAnnotation) };
}

export function parseDocumentInput(value: unknown): VlezetDocumentV1 | VlezetDocumentV2 | VlezetDocumentV3 {
  const input = record(value, "Документ проекта");
  if (input.schemaVersion === 1) return { schemaVersion: 1, walls: array(input.walls, "Стены").map(parseV1Wall) };
  if (input.schemaVersion === 2) return { schemaVersion: 2, ...parseShell(input) };
  if (input.schemaVersion === 3) return { schemaVersion: 3, ...parseShell(input), placedObjects: array(input.placedObjects, "Предметы").map(parsePlacedObject) };
  throw new ProjectValidationError("Версия документа проекта не поддерживается.");
}

export function parseAndMigrateDocument(value: unknown): VlezetDocument {
  return migrateDocument(parseDocumentInput(value));
}

export type CreateProjectInput = Readonly<{
  id: string;
  name: string;
  now: string;
  document?: VlezetDocument;
  viewport?: ProjectViewport;
  ui?: ProjectUiState;
  referencePlan?: ReferencePlan | null;
}>;

export function createProject(input: CreateProjectInput): VlezetProjectRecord {
  const id = input.id.trim();
  if (!id) throw new ProjectValidationError("Идентификатор проекта не может быть пустым.");
  const timestamp = isoTimestamp(input.now, "Дата проекта");
  return {
    storageVersion: PROJECT_STORAGE_VERSION,
    id,
    name: normalizeProjectName(input.name),
    createdAt: timestamp,
    updatedAt: timestamp,
    document: parseAndMigrateDocument(input.document ?? createEmptyDocument()),
    viewport: validateProjectViewport(input.viewport ?? DEFAULT_PROJECT_VIEWPORT),
    ui: validateProjectUi(input.ui ?? DEFAULT_PROJECT_UI),
    referencePlan: input.referencePlan == null ? null : validateReferencePlan(input.referencePlan),
  };
}

export function validateProject(value: unknown): VlezetProjectRecord {
  const input = record(value, "Проект");
  if (input.storageVersion !== 1 && input.storageVersion !== PROJECT_STORAGE_VERSION) {
    throw new ProjectValidationError("Версия локального проекта не поддерживается.");
  }
  const id = text(input.id, "Идентификатор проекта").trim();
  if (!id) throw new ProjectValidationError("Идентификатор проекта не может быть пустым.");
  return {
    storageVersion: PROJECT_STORAGE_VERSION,
    id,
    name: normalizeProjectName(input.name),
    createdAt: isoTimestamp(input.createdAt, "Дата создания"),
    updatedAt: isoTimestamp(input.updatedAt, "Дата изменения"),
    document: parseAndMigrateDocument(input.document),
    viewport: validateProjectViewport(input.viewport),
    ui: validateProjectUi(input.ui),
    referencePlan: input.referencePlan == null ? null : validateReferencePlan(input.referencePlan),
  };
}

function changed(now: string): string {
  return isoTimestamp(now, "Дата изменения");
}

export function renameProject(project: VlezetProjectRecord, name: string, now: string): VlezetProjectRecord {
  return validateProject({ ...project, name: normalizeProjectName(name), updatedAt: changed(now) });
}

export function replaceProjectDocument(project: VlezetProjectRecord, document: VlezetDocument, now: string): VlezetProjectRecord {
  return validateProject({ ...project, document, updatedAt: changed(now) });
}

export function replaceProjectViewport(project: VlezetProjectRecord, viewport: ProjectViewport, now: string): VlezetProjectRecord {
  return validateProject({ ...project, viewport, updatedAt: changed(now) });
}

export function replaceProjectUi(project: VlezetProjectRecord, ui: ProjectUiState, now: string): VlezetProjectRecord {
  return validateProject({ ...project, ui, updatedAt: changed(now) });
}

export function replaceProjectReferencePlan(project: VlezetProjectRecord, referencePlan: ReferencePlan | null, now: string): VlezetProjectRecord {
  return validateProject({ ...project, referencePlan, updatedAt: changed(now) });
}

export function updateReferencePlanDisplay(project: VlezetProjectRecord, patch: Partial<ReferencePlanDisplay>, now: string): VlezetProjectRecord {
  if (!project.referencePlan) throw new ProjectValidationError("В проекте нет подложки.");
  return replaceProjectReferencePlan(project, {
    ...project.referencePlan,
    display: { ...project.referencePlan.display, ...patch },
  }, now);
}

export function duplicateProject(project: VlezetProjectRecord, newId: string, now: string): VlezetProjectRecord {
  const suffix = " — копия";
  const base = project.name.slice(0, Math.max(1, MAX_PROJECT_NAME_LENGTH - suffix.length)).trimEnd();
  return createProject({
    id: newId,
    name: `${base}${suffix}`,
    now,
    document: structuredClone(project.document),
    viewport: structuredClone(project.viewport),
    ui: structuredClone(project.ui),
    referencePlan: project.referencePlan ? structuredClone(project.referencePlan) : null,
  });
}
