"use client";

import { projectDocumentToSpatialScene } from "@vlezet/spatial";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useStore } from "zustand";
import { editorStore } from "../editor/use-editor-store";
import { deriveCameraPlacement, type SpatialCameraPreset } from "./camera";
import { buildSpatialSceneGroup } from "./spatial-scene-renderer";

export type SpatialViewerProps = Readonly<{
  fitRequest: number;
}>;

type Runtime = Readonly<{
  fit: (preset: SpatialCameraPreset) => void;
}>;

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
  const runtimeRef = useRef<Runtime | null>(null);
  const [preset, setPreset] = useState<SpatialCameraPreset>("perspective");
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resources: ReturnType<typeof buildSpatialSceneGroup> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    try {
      setFailure(null);
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

      const ambient = new THREE.HemisphereLight(0xffffff, 0xb8c0cc, 1.65);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffffff, 2.1);
      sun.position.set(7000, 11_000, 5000);
      scene.add(sun);

      const worldBox = new THREE.Box3().setFromObject(resources.group);
      const cameraBox = worldBox.isEmpty() ? fallbackBounds() : worldBox;
      const size = cameraBox.getSize(new THREE.Vector3());
      const center = cameraBox.getCenter(new THREE.Vector3());
      const gridSize = Math.max(10_000, Math.ceil(Math.max(size.x, size.z) * 1.5 / 1000) * 1000);
      const grid = new THREE.GridHelper(gridSize, Math.max(10, Math.round(gridSize / 500)), 0xcbd2dc, 0xe1e5ea);
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

      runtimeRef.current = { fit };
      fit("perspective");

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      renderer.setAnimationLoop(() => {
        controls?.update();
        renderer?.render(scene, camera);
      });
    } catch (error) {
      console.error("[Vlezet:SPATIAL] viewer initialization failed", error);
      setFailure("3D недоступен в этом браузере или видеорежиме. План в 2D остаётся полностью доступен.");
    }

    return () => {
      runtimeRef.current = null;
      resizeObserver?.disconnect();
      renderer?.setAnimationLoop(null);
      controls?.dispose();
      resources?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [projection.scene]);

  useEffect(() => {
    runtimeRef.current?.fit(preset);
  }, [fitRequest, preset]);

  const choosePreset = (next: SpatialCameraPreset) => {
    setPreset(next);
    runtimeRef.current?.fit(next);
  };

  return (
    <section className="spatial-viewer-shell" aria-label="Трёхмерный вид квартиры">
      <div ref={containerRef} className="spatial-viewer-canvas" />
      <div className="spatial-viewer-controls" aria-label="Камера 3D">
        <button type="button" className={preset === "perspective" ? "is-active" : ""} onClick={() => choosePreset("perspective")}>Перспектива</button>
        <button type="button" className={preset === "isometric" ? "is-active" : ""} onClick={() => choosePreset("isometric")}>Изометрия</button>
        <button type="button" className={preset === "top" ? "is-active" : ""} onClick={() => choosePreset("top")}>Сверху</button>
      </div>
      <div className="spatial-viewer-help">ЛКМ — вращение · ПКМ — панорама · колесо — масштаб</div>
      {projection.diagnostics.length > 0 ? (
        <div className="spatial-viewer-warning" role="status">
          Часть 3D-геометрии пропущена: {projection.diagnostics[0]?.message}
        </div>
      ) : null}
      {failure ? <div className="spatial-viewer-error" role="alert">{failure}</div> : null}
      {projection.scene.wallSegments.length === 0 && projection.scene.floors.length === 0 ? (
        <div className="spatial-viewer-empty">Сначала создайте стены в 2D — здесь появится их пространственная проекция.</div>
      ) : null}
    </section>
  );
}
