"use client";

import { projectDocumentToSpatialScene } from "@vlezet/spatial";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useStore } from "zustand";
import { editorStore } from "../editor/use-editor-store";
import { deriveCameraPlacement, type SpatialCameraPreset } from "./camera";
import {
  buildSpatialInspectionDetails,
  firstSpatialInspectionTarget,
  sameSpatialInspectionTarget,
  type SpatialInspectionTarget,
} from "./spatial-inspection";
import { SpatialInspector } from "./spatial-inspector";
import {
  buildSpatialSceneGroup,
  disposeObject3DResources,
  type SpatialEmphasisMode,
} from "./spatial-scene-renderer";
import styles from "./spatial-viewer.module.css";

export type SpatialViewerProps = Readonly<{
  fitRequest: number;
}>;

type Runtime = Readonly<{
  fit: (preset: SpatialCameraPreset) => void;
  emphasize: (target: SpatialInspectionTarget | null, mode: SpatialEmphasisMode) => void;
}>;

const WEBGL_FAILURE_MESSAGE = "3D недоступен в этом браузере или видеорежиме. План в 2D остаётся полностью доступен.";

function fallbackBounds(): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(-1000, 0, -1000),
    new THREE.Vector3(1000, 2700, 1000),
  );
}

export function SpatialViewer({ fitRequest }: SpatialViewerProps) {
  const document = useStore(editorStore, (state) => state.history.document);
  const projection = useMemo(() => projectDocumentToSpatialScene(document), [document]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const failureRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const [preset, setPreset] = useState<SpatialCameraPreset>("perspective");
  const [hoveredTarget, setHoveredTarget] = useState<SpatialInspectionTarget | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SpatialInspectionTarget | null>(null);
  const activeTarget = selectedTarget ?? hoveredTarget;
  const details = useMemo(
    () => activeTarget ? buildSpatialInspectionDetails(document, projection.scene, activeTarget) : null,
    [activeTarget, document, projection.scene],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (failureRef.current) failureRef.current.hidden = true;

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resources: ReturnType<typeof buildSpatialSceneGroup> | null = null;
    let grid: THREE.GridHelper | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let removePointerListeners: (() => void) | null = null;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf4f6f9);

      const camera = new THREE.PerspectiveCamera(45, 1, 1, 100_000);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      controls.minDistance = 100;
      controls.maxDistance = 100_000;

      resources = buildSpatialSceneGroup(projection.scene);
      scene.add(resources.group);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0cc, 1.65));
      const sun = new THREE.DirectionalLight(0xffffff, 2.1);
      sun.position.set(7000, 11_000, 5000);
      scene.add(sun);

      const worldBox = new THREE.Box3().setFromObject(resources.group);
      const cameraBox = worldBox.isEmpty() ? fallbackBounds() : worldBox;
      const size = cameraBox.getSize(new THREE.Vector3());
      const center = cameraBox.getCenter(new THREE.Vector3());
      const gridSize = Math.max(10_000, Math.ceil(Math.max(size.x, size.z) * 1.5 / 1000) * 1000);
      grid = new THREE.GridHelper(gridSize, Math.max(10, Math.round(gridSize / 500)), 0xcbd2dc, 0xe1e5ea);
      grid.position.set(center.x, -2, center.z);
      scene.add(grid);

      const resize = () => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const fit = (nextPreset: SpatialCameraPreset) => {
        resize();
        const placement = deriveCameraPlacement({
          min: { x: cameraBox.min.x, y: cameraBox.min.y, z: cameraBox.min.z },
          max: { x: cameraBox.max.x, y: cameraBox.max.y, z: cameraBox.max.z },
        }, nextPreset, camera.aspect);
        camera.near = placement.near;
        camera.far = placement.far;
        camera.position.set(placement.position.x, placement.position.y, placement.position.z);
        controls?.target.set(placement.target.x, placement.target.y, placement.target.z);
        camera.up.set(0, 1, 0);
        camera.updateProjectionMatrix();
        controls?.update();
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerDown: Readonly<{ x: number; y: number }> | null = null;
      const pick = (event: PointerEvent): SpatialInspectionTarget | null => {
        if (!renderer || !resources) return null;
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const intersections = raycaster.intersectObject(resources.group, true);
        return firstSpatialInspectionTarget(intersections.map((intersection) => intersection.object));
      };
      const onPointerMove = (event: PointerEvent) => {
        const next = pick(event);
        setHoveredTarget((current) => sameSpatialInspectionTarget(current, next) ? current : next);
        if (renderer) renderer.domElement.style.cursor = next ? "pointer" : "grab";
      };
      const onPointerDown = (event: PointerEvent) => {
        pointerDown = { x: event.clientX, y: event.clientY };
      };
      const onClick = (event: PointerEvent) => {
        if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) {
          pointerDown = null;
          return;
        }
        pointerDown = null;
        const next = pick(event);
        setSelectedTarget((current) => sameSpatialInspectionTarget(current, next) ? current : next);
      };
      const onPointerLeave = () => {
        pointerDown = null;
        setHoveredTarget(null);
        if (renderer) renderer.domElement.style.cursor = "grab";
      };

      renderer.domElement.style.cursor = "grab";
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("click", onClick);
      renderer.domElement.addEventListener("pointerleave", onPointerLeave);
      removePointerListeners = () => {
        renderer?.domElement.removeEventListener("pointermove", onPointerMove);
        renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer?.domElement.removeEventListener("click", onClick);
        renderer?.domElement.removeEventListener("pointerleave", onPointerLeave);
      };

      runtimeRef.current = { fit, emphasize: resources.emphasize };
      fit("perspective");
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      renderer.setAnimationLoop(() => {
        controls?.update();
        renderer?.render(scene, camera);
      });
    } catch (error) {
      console.error("[Vlezet:SPATIAL] viewer initialization failed", error);
      if (failureRef.current) {
        failureRef.current.textContent = WEBGL_FAILURE_MESSAGE;
        failureRef.current.hidden = false;
      }
    }

    return () => {
      runtimeRef.current = null;
      removePointerListeners?.();
      resizeObserver?.disconnect();
      renderer?.setAnimationLoop(null);
      controls?.dispose();
      resources?.dispose();
      if (grid) disposeObject3DResources(grid);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [projection.scene]);

  useEffect(() => {
    runtimeRef.current?.fit(preset);
  }, [fitRequest, preset]);

  useEffect(() => {
    runtimeRef.current?.emphasize(activeTarget, selectedTarget ? "selected" : "hover");
  }, [activeTarget, projection.scene, selectedTarget]);

  useEffect(() => {
    if (!activeTarget || details) return;
    setSelectedTarget(null);
    setHoveredTarget(null);
  }, [activeTarget, details]);

  const choosePreset = (next: SpatialCameraPreset) => {
    setPreset(next);
    runtimeRef.current?.fit(next);
  };

  return (
    <section className={styles.shell} aria-label="Трёхмерный вид квартиры">
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.controls} aria-label="Камера 3D">
        <button type="button" className={preset === "perspective" ? styles.active : undefined} onClick={() => choosePreset("perspective")}>Перспектива</button>
        <button type="button" className={preset === "isometric" ? styles.active : undefined} onClick={() => choosePreset("isometric")}>Изометрия</button>
        <button type="button" className={preset === "top" ? styles.active : undefined} onClick={() => choosePreset("top")}>Сверху</button>
      </div>
      {details ? (
        <SpatialInspector
          details={details}
          selected={selectedTarget !== null}
          onClear={() => setSelectedTarget(null)}
        />
      ) : null}
      <div className={styles.help}>ЛКМ — вращение · клик — выбрать · ПКМ — панорама · колесо — масштаб</div>
      {projection.diagnostics.length > 0 ? <div className={styles.warning} role="status">Часть 3D-геометрии пропущена: {projection.diagnostics[0]?.message}</div> : null}
      <div ref={failureRef} className={styles.error} role="alert" hidden />
      {projection.scene.wallSegments.length === 0 && projection.scene.floors.length === 0 ? <div className={styles.empty}>Сначала создайте стены в 2D — здесь появится их пространственная проекция.</div> : null}
    </section>
  );
}
