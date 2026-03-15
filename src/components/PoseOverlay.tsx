"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type PoseLandmarks = Array<{ x: number; y: number; z?: number }>;

type GuideMode = "none" | "skeleton" | "box";
type BoxRenderMode = "off" | "wire" | "solid";
export type GizmoMode = "translate" | "rotate" | "scale";

export type BoxUpdateInfo = {
  key: BoxKey;
  positionOffset: THREE.Vector3;
  rotationOffset: THREE.Quaternion;
  scaleVec: THREE.Vector3;
};

type Props = {
  imageSrc: string | null;
  guideMode: GuideMode;
  boxOpacity?: number;
  enable3DBox?: boolean;
  boxRenderMode?: BoxRenderMode;
  ribcageScale?: number;
  ribHeightScale?: number;
  waistScale?: number;
  waistHeightScale?: number;
  pelvisScale?: number;
  pelvisHeightScale?: number;
  boxThickness?: number;
  upperArmThickness?: number;
  lowerArmThickness?: number;
  thighThickness?: number;
  calfThickness?: number;
  onLandmarks?: (landmarks: PoseLandmarks | null) => void;
  /** 기즈모로 박스 변환 시 부모에게 변경값 전달 */
  onBoxUpdate?: (info: BoxUpdateInfo) => void;
  /** 선택된 박스 키 변경 시 부모에게 전달 */
  onSelectedKeyChange?: (key: BoxKey | null) => void;
  /** CSS transform scale 값 (기본 1) */
  zoom?: number;
};

// ── Pose landmark indices ────────────────────────────────────────────────────
const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

// ── Types ────────────────────────────────────────────────────────────────────
type TorsoKey = "head" | "neck" | "rib" | "waist" | "pelvis";
type LimbKey =
  | "leftUpperArm"
  | "rightUpperArm"
  | "leftLowerArm"
  | "rightLowerArm"
  | "leftThigh"
  | "rightThigh"
  | "leftCalf"
  | "rightCalf";
export type BoxKey = TorsoKey | LimbKey;

type BoxVisual = {
  key: BoxKey;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  midline?: THREE.Line;
  sideDiagonal?: THREE.Line;
  faceColor: number;
  edgeColor: number;
};

type SceneBundle = {
  torso: { head: BoxVisual; neck: BoxVisual; rib: BoxVisual; waist: BoxVisual; pelvis: BoxVisual };
  limbs: Record<LimbKey, BoxVisual>;
  joints: Record<string, THREE.Mesh>;
};

/** 수동 보정값. 기즈모 결과가 이 값에 기록된다. */
type ManualTransform = {
  positionOffset: THREE.Vector3;
  rotationOffset: THREE.Quaternion;
  /** 축별 스케일 배율 (1,1,1 = 원본) */
  scaleVec: THREE.Vector3;
};

/** updateMeshes가 매 프레임 기록하는 '기저 변환' (manual 적용 전) */
type BaseTransform = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

const ALL_BOX_KEYS: BoxKey[] = [
  "head", "neck", "rib", "waist", "pelvis",
  "leftUpperArm", "rightUpperArm",
  "leftLowerArm", "rightLowerArm",
  "leftThigh", "rightThigh",
  "leftCalf", "rightCalf",
];

function createManualMap(): Record<BoxKey, ManualTransform> {
  return ALL_BOX_KEYS.reduce((acc, key) => {
    acc[key] = {
      positionOffset: new THREE.Vector3(),
      rotationOffset: new THREE.Quaternion(),
      scaleVec: new THREE.Vector3(1, 1, 1),
    };
    return acc;
  }, {} as Record<BoxKey, ManualTransform>);
}

function getBoxVisualByKey(bundle: SceneBundle, key: BoxKey): BoxVisual | null {
  if (key === "head") return bundle.torso.head;
  if (key === "neck") return bundle.torso.neck;
  if (key === "rib") return bundle.torso.rib;
  if (key === "waist") return bundle.torso.waist;
  if (key === "pelvis") return bundle.torso.pelvis;
  return (bundle.limbs as Record<string, BoxVisual>)[key] ?? null;
}

// ── Gizmo 모드 레이블 ────────────────────────────────────────────────────────
const GIZMO_MODE_LABEL: Record<GizmoMode, string> = {
  translate: "이동 (T)",
  rotate: "회전 (R)",
  scale: "스케일 (S)",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function PoseOverlay({
  imageSrc,
  guideMode,
  boxOpacity = 0.85,
  enable3DBox = false,
  boxRenderMode = "wire",
  ribcageScale = 1.05,
  ribHeightScale = 1,
  waistScale = 1,
  waistHeightScale = 1,
  pelvisScale = 1,
  pelvisHeightScale = 1,
  boxThickness = 0.4,
  upperArmThickness = 0.9,
  lowerArmThickness = 0.78,
  thighThickness = 1,
  calfThickness = 0.88,
  onLandmarks,
  onBoxUpdate,
  onSelectedKeyChange,
  zoom = 1,
}: Props) {
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const threeLayerRef = useRef<HTMLDivElement>(null);

  const poseConnectionsRef = useRef<Array<{ start: number; end: number }> | null>(null);
  const landmarksRef = useRef<PoseLandmarks | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const bundleRef = useRef<SceneBundle | null>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const manualRef = useRef<Record<BoxKey, ManualTransform>>(createManualMap());
  /** 매 프레임 updateMeshes가 기록하는 기저 변환 */
  const baseTransformsRef = useRef<Partial<Record<BoxKey, BaseTransform>>>({});

  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionAttempted, setDetectionAttempted] = useState(false);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [selectedKey, setSelectedKey] = useState<BoxKey | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const gizmoModeSetterRef = useRef<((mode: GizmoMode) => void) | null>(null);
  const flashSetterRef = useRef<((key: string) => void) | null>(null);
  flashSetterRef.current = (key: string) => {
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 150);
  };

  const showGuide = guideMode === "skeleton" || guideMode === "box";
  const showSkeleton = guideMode === "skeleton";
  const showThree = guideMode === "box" && enable3DBox;

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    onSelectedKeyChange?.(selectedKey);
  }, [selectedKey, onSelectedKeyChange]);

  // ── MediaPipe 포즈 분석 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!imageSrc || !showGuide) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = async () => {
      setLoading(true);
      setError(null);
      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        poseConnectionsRef.current = PoseLandmarker.POSE_CONNECTIONS;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          },
          runningMode: "IMAGE",
        });

        const result = poseLandmarker.detect(img);
        if (result.landmarks && result.landmarks[0]) {
          const pts = result.landmarks[0].map((l) => ({
            x: clamp01(l.x),
            y: clamp01(l.y),
            z: l.z,
          }));
          setLandmarks(pts);
          onLandmarks?.(pts);
        } else {
          setLandmarks(null);
          onLandmarks?.(null);
        }
      } catch (e) {
        console.error("MediaPipe PoseLandmarker error:", e);
        setError(e instanceof Error ? e.message : "포즈 분석 실패");
        setLandmarks(null);
        onLandmarks?.(null);
      } finally {
        setLoading(false);
        setDetectionAttempted(true);
      }
    };

    img.onerror = () => {
      setError("이미지 로드 실패");
      setLoading(false);
    };
  }, [imageSrc, showGuide, onLandmarks]);

  useEffect(() => {
    if (!showGuide || !imageSrc) {
      setLandmarks(null);
      setError(null);
      setDetectionAttempted(false);
    }
  }, [showGuide, imageSrc]);

  useEffect(() => {
    manualRef.current = createManualMap();
    baseTransformsRef.current = {};
    setSelectedKey(null);
  }, [imageSrc]);

  // ── 스켈레톤 캔버스 렌더 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showSkeleton) {
      const canvas = skeletonCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const canvas = skeletonCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete || !landmarks) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const toCanvas = (x: number, y: number) => ({ x: x * rect.width, y: y * rect.height });
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const connections = poseConnectionsRef.current;
    if (connections) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      for (const { start, end } of connections) {
        const a = landmarks[start];
        const b = landmarks[end];
        if (!a || !b) continue;
        if (a.x < 0 || a.x > 1 || a.y < 0 || a.y > 1) continue;
        if (b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1) continue;
        const p1 = toCanvas(a.x, a.y);
        const p2 = toCanvas(b.x, b.y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }, [landmarks, showSkeleton]);

  // ── Three.js 씬 + TransformControls ─────────────────────────────────────
  useEffect(() => {
    if (!showThree || !threeLayerRef.current) return;

    const container = threeLayerRef.current;
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    container.style.overflow = "hidden";

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);

    // ── 박스/실린더 생성 헬퍼 ──────────────────────────────────────────────
    const createBox = (
      key: BoxKey,
      opts?: {
        midline?: boolean;
        sideDiagonal?: boolean;
        faceColor?: number;
        edgeColor?: number;
        shape?: "box" | "cylinder";
      }
    ): BoxVisual => {
      const faceColor = opts?.faceColor ?? 0xf8f8f8;
      const edgeColor = opts?.edgeColor ?? 0x0a0a0a;
      const shape = opts?.shape ?? "box";
      const geometry =
        shape === "cylinder"
          ? new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false)
          : new THREE.BoxGeometry(1, 1, 1);

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: faceColor,
          transparent: true,
          opacity: boxOpacity,
          side: THREE.DoubleSide,
        })
      );

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacity })
      );
      mesh.add(edges);

      let midline: THREE.Line | undefined;
      if (opts?.midline) {
        midline = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.5, 0.501),
            new THREE.Vector3(0, -0.5, 0.501),
          ]),
          new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacity })
        );
        mesh.add(midline);
      }

      let sideDiagonal: THREE.Line | undefined;
      if (opts?.sideDiagonal) {
        sideDiagonal = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.5, 0.5, 0.5),
            new THREE.Vector3(0.5, -0.5, -0.5),
          ]),
          new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacity })
        );
        mesh.add(sideDiagonal);
      }

      scene.add(mesh);
      return { key, mesh, edges, midline, sideDiagonal, faceColor, edgeColor };
    };

    const torso = {
      head: createBox("head", { midline: true, shape: "box", faceColor: 0xfce7f3, edgeColor: 0xbe185d }),
      neck: createBox("neck", { shape: "cylinder", faceColor: 0xfce7f3, edgeColor: 0xbe185d }),
      rib: createBox("rib", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xdbeafe, edgeColor: 0x1d4ed8 }),
      waist: createBox("waist", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xe9d5ff, edgeColor: 0x7e22ce }),
      pelvis: createBox("pelvis", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xfef3c7, edgeColor: 0xb45309 }),
    };

    const limbs: Record<LimbKey, BoxVisual> = {
      leftUpperArm: createBox("leftUpperArm", { shape: "cylinder", faceColor: 0xe0f2fe, edgeColor: 0x0284c7 }),
      rightUpperArm: createBox("rightUpperArm", { shape: "cylinder", faceColor: 0xe0f2fe, edgeColor: 0x0284c7 }),
      leftLowerArm: createBox("leftLowerArm", { shape: "cylinder", faceColor: 0xccfbf1, edgeColor: 0x0f766e }),
      rightLowerArm: createBox("rightLowerArm", { shape: "cylinder", faceColor: 0xccfbf1, edgeColor: 0x0f766e }),
      leftThigh: createBox("leftThigh", { shape: "cylinder", faceColor: 0xffedd5, edgeColor: 0xc2410c }),
      rightThigh: createBox("rightThigh", { shape: "cylinder", faceColor: 0xffedd5, edgeColor: 0xc2410c }),
      leftCalf: createBox("leftCalf", { shape: "cylinder", faceColor: 0xffe4e6, edgeColor: 0xbe123c }),
      rightCalf: createBox("rightCalf", { shape: "cylinder", faceColor: 0xffe4e6, edgeColor: 0xbe123c }),
    };

    const createJointSphere = (color: number) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: boxOpacity })
      );
      scene.add(sphere);
      return sphere;
    };

    const joints = {
      leftElbow: createJointSphere(0xffffff),
      rightElbow: createJointSphere(0xffffff),
      leftKnee: createJointSphere(0xffffff),
      rightKnee: createJointSphere(0xffffff),
    };

    bundleRef.current = { torso, limbs, joints };
    rendererRef.current = renderer;
    cameraRef.current = camera;
    sceneRef.current = scene;

    const getAllBoxes = (): BoxVisual[] => {
      const b = bundleRef.current;
      if (!b) return [];
      return [b.torso.head, b.torso.neck, b.torso.rib, b.torso.waist, b.torso.pelvis, ...Object.values(b.limbs)];
    };

    // ── 렌더 모드 적용 ────────────────────────────────────────────────────
    const applyRenderMode = (currentSelectedKey: BoxKey | null) => {
      const isOff = boxRenderMode === "off";
      const wire = boxRenderMode === "wire";

      for (const box of getAllBoxes()) {
        box.mesh.visible = !isOff;
        const boxMat = box.mesh.material as THREE.MeshBasicMaterial;
        boxMat.opacity = wire ? Math.min(0.35, boxOpacity * 0.45) : Math.min(0.75, boxOpacity);
        boxMat.color.setHex(box.faceColor);
        boxMat.needsUpdate = true;

        const lineParts = [box.edges, box.midline, box.sideDiagonal].filter(Boolean) as Array<
          THREE.Line | THREE.LineSegments
        >;
        for (const part of lineParts) {
          part.visible = !isOff;
          const lineMat = part.material as THREE.LineBasicMaterial;
          lineMat.color.setHex(currentSelectedKey === box.key ? 0xff2d2d : box.edgeColor);
          lineMat.opacity = boxOpacity;
          lineMat.needsUpdate = true;
        }
      }

      for (const mesh of Object.values(bundleRef.current?.joints ?? {})) {
        mesh.visible = !isOff;
        const m = mesh.material as THREE.MeshBasicMaterial;
        m.color.setHex(0xffe45e);
        m.opacity = Math.min(1, boxOpacity + 0.1);
        m.wireframe = false;
        m.needsUpdate = true;
      }
    };

    // ── 씬 크기 동기화 ────────────────────────────────────────────────────
    const updateSize = () => {
      const img = imageRef.current;
      if (!img || !cameraRef.current || !rendererRef.current) return;
      const rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const z = zoomRef.current;
      const w = rect.width / z;
      const h = rect.height / z;

      container.style.width = `${w}px`;
      container.style.height = `${h}px`;
      rendererRef.current.setSize(w, h, false);
      cameraRef.current.aspect = w / h;

      const worldHeight = 2;
      const fovRad = (cameraRef.current.fov * Math.PI) / 180;
      cameraRef.current.position.z = worldHeight / 2 / Math.tan(fovRad / 2);
      cameraRef.current.updateProjectionMatrix();
    };

    // ── 메시 업데이트 (랜드마크 → 월드 변환) ────────────────────────────
    /**
     * 1) 기저 변환(base)을 계산해 baseTransformsRef에 기록
     * 2) base * manual 을 메시에 적용
     * TransformControls의 object-change가 manualRef를 업데이트하므로
     * 다음 프레임에서 updateMeshes가 같은 결과를 재현한다.
     */
    const updateMeshes = (currentSelectedKey: BoxKey | null) => {
      const pts = landmarksRef.current;
      const bundle = bundleRef.current;
      const img = imageRef.current;
      if (!pts || !bundle || !img) return;

      const ls = pts[LEFT_SHOULDER];
      const rs = pts[RIGHT_SHOULDER];
      const lh = pts[LEFT_HIP];
      const rh = pts[RIGHT_HIP];
      if (!ls || !rs || !lh || !rh) return;

      const rawRect = img.getBoundingClientRect();
      if (rawRect.width <= 0 || rawRect.height <= 0) return;
      const rect = { width: rawRect.width / zoomRef.current, height: rawRect.height / zoomRef.current };

      const aspect = rect.width / rect.height;
      const worldHeight = 2;
      const worldWidth = worldHeight * aspect;
      const depthScale = worldWidth * 0.22;
      const valid = (p: { x: number; y: number }) =>
        p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

      const toWorld2D = (p: { x: number; y: number }) =>
        new THREE.Vector3((p.x - 0.5) * worldWidth, (0.5 - p.y) * worldHeight, 0);
      const toWorld3D = (p: { x: number; y: number; z?: number }) =>
        new THREE.Vector3(
          (p.x - 0.5) * worldWidth,
          (0.5 - p.y) * worldHeight,
          -(p.z ?? 0) * depthScale
        );

      const pLS2 = toWorld2D(ls), pRS2 = toWorld2D(rs);
      const pLH2 = toWorld2D(lh), pRH2 = toWorld2D(rh);
      const pLS3 = toWorld3D(ls), pRS3 = toWorld3D(rs);
      const pLH3 = toWorld3D(lh), pRH3 = toWorld3D(rh);

      const shoulderMid2 = pLS2.clone().add(pRS2).multiplyScalar(0.5);
      const hipMid2 = pLH2.clone().add(pRH2).multiplyScalar(0.5);
      const shoulderMid3 = pLS3.clone().add(pRS3).multiplyScalar(0.5);
      const hipMid3 = pLH3.clone().add(pRH3).multiplyScalar(0.5);

      const upAxis = shoulderMid3.clone().sub(hipMid3).normalize();
      const rawLateral = pRS3.clone().sub(pLS3);
      if (rawLateral.lengthSq() < 1e-6) return;

      let forwardAxis = rawLateral.clone().cross(upAxis).normalize();
      if (forwardAxis.lengthSq() < 1e-6) forwardAxis = new THREE.Vector3(0, 0, 1);
      const lateralAxis = upAxis.clone().cross(forwardAxis).normalize();
      const torsoBaseRotation = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(lateralAxis, upAxis, forwardAxis)
      );

      const shoulderYaw = ((rs.z ?? 0) - (ls.z ?? 0)) * 3.0;
      const hipYaw = ((rh.z ?? 0) - (lh.z ?? 0)) * 3.6;
      const ribRotation = torsoBaseRotation
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, shoulderYaw));
      const pelvisRotation = torsoBaseRotation
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, hipYaw));

      const shoulderWidth = pRS2.distanceTo(pLS2);
      const hipWidth = pRH2.distanceTo(pLH2);
      const torsoLength = Math.max(shoulderMid2.distanceTo(hipMid2), worldHeight * 0.18);
      const torsoUp2 = shoulderMid2.clone().sub(hipMid2).normalize();

      // ── 토르소 박스 ────────────────────────────────────────────────────
      const applyTorsoBox = (
        box: BoxVisual,
        basePos: THREE.Vector3,
        baseQuat: THREE.Quaternion,
        bx: number, by: number, bz: number
      ) => {
        const manual = manualRef.current[box.key];
        baseTransformsRef.current[box.key] = {
          position: basePos.clone(),
          quaternion: baseQuat.clone(),
          scale: new THREE.Vector3(bx, by, bz),
        };

        if (isDraggingRef.current && currentSelectedKey === box.key) {
          return;
        }

        box.mesh.position.copy(basePos).add(manual.positionOffset);
        box.mesh.quaternion.copy(baseQuat).multiply(manual.rotationOffset);
        box.mesh.scale.set(
          bx * manual.scaleVec.x,
          by * manual.scaleVec.y,
          bz * manual.scaleVec.z
        );
      };

      const ribHeight = Math.max(torsoLength * 0.4, worldHeight * 0.11) * ribHeightScale;
      const ribShoulderLift = torsoLength * 0.08;
      const ribCenter = shoulderMid2.clone().add(torsoUp2.clone().multiplyScalar(ribShoulderLift - ribHeight * 0.5));
      const ribDepth = Math.max(shoulderWidth * boxThickness * 1.35, worldWidth * 0.055);
      applyTorsoBox(
        bundle.torso.rib,
        ribCenter, ribRotation,
        Math.max(shoulderWidth * ribcageScale, worldWidth * 0.08),
        ribHeight, ribDepth
      );

      const waistHeight = Math.max(torsoLength * 0.25, worldHeight * 0.09) * waistHeightScale;
      const waistCenter = shoulderMid2.clone().lerp(hipMid2, 0.56);
      const waistWidth = shoulderWidth * 0.72 + hipWidth * 0.28;
      const waistDepth = Math.max(((shoulderWidth + hipWidth) * 0.5) * boxThickness * 1.12, worldWidth * 0.045);
      const waistYaw = shoulderYaw * 0.45 + hipYaw * 0.55;
      const waistRotation = torsoBaseRotation
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, waistYaw));
      applyTorsoBox(
        bundle.torso.waist,
        waistCenter, waistRotation,
        Math.max(waistWidth * waistScale, worldWidth * 0.07),
        waistHeight, waistDepth
      );

      const pelvisHeight = Math.max(torsoLength * 0.33, worldHeight * 0.12) * pelvisHeightScale;
      const pelvisCenter = hipMid2.clone().add(torsoUp2.clone().multiplyScalar(pelvisHeight * 0.5));
      const pelvisDepth = Math.max(hipWidth * boxThickness * 1.7, worldWidth * 0.065);
      applyTorsoBox(
        bundle.torso.pelvis,
        pelvisCenter, pelvisRotation,
        Math.max(hipWidth * pelvisScale, worldWidth * 0.08),
        pelvisHeight, pelvisDepth
      );

      // ── 머리 박스 ──────────────────────────────────────────────────────
      const lEar = pts[LEFT_EAR];
      const rEar = pts[RIGHT_EAR];
      const nose = pts[NOSE];
      if (lEar && rEar && nose && valid(lEar) && valid(rEar) && valid(nose)) {
        const pLE2 = toWorld2D(lEar), pRE2 = toWorld2D(rEar);
        const pLE3 = toWorld3D(lEar), pRE3 = toWorld3D(rEar);
        const pNose3 = toWorld3D(nose);

        const earMid2 = pLE2.clone().add(pRE2).multiplyScalar(0.5);
        const earWidth = pLE2.distanceTo(pRE2);
        const headW = Math.max(earWidth * 1.15, worldWidth * 0.06);
        const headH = headW * 1.35;
        const headD = headW * 0.95;

        const headCenter = earMid2.clone().add(new THREE.Vector3(0, headH * 0.1, 0));

        const earLateral3 = pRE3.clone().sub(pLE3).normalize();
        const noseDir3 = pNose3.clone().sub(pLE3.clone().add(pRE3).multiplyScalar(0.5)).normalize();
        const headUp3 = earLateral3.clone().cross(noseDir3).normalize();
        let headForward3 = earLateral3.clone().cross(headUp3).normalize();
        if (headForward3.lengthSq() < 1e-6) headForward3 = new THREE.Vector3(0, 0, 1);
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(earLateral3, headUp3, headForward3)
        );

        bundle.torso.head.mesh.visible = boxRenderMode !== "off";
        applyTorsoBox(bundle.torso.head, headCenter, headQuat, headW, headH, headD);
      } else {
        bundle.torso.head.mesh.visible = false;
      }

      // ── 목 실린더 ──────────────────────────────────────────────────────
      if (lEar && rEar && valid(lEar) && valid(rEar)) {
        const pLE2 = toWorld2D(lEar), pRE2 = toWorld2D(rEar);
        const pLE3 = toWorld3D(lEar), pRE3 = toWorld3D(rEar);
        const earMid2 = pLE2.clone().add(pRE2).multiplyScalar(0.5);
        const earMid3 = pLE3.clone().add(pRE3).multiplyScalar(0.5);

        const neckTop2 = earMid2;
        const neckBot2 = shoulderMid2.clone();
        const neckTop3 = earMid3;
        const neckBot3 = shoulderMid3.clone();
        const neckLength = neckBot2.distanceTo(neckTop2);

        if (neckLength > worldHeight * 0.01) {
          const dir2 = neckTop2.clone().sub(neckBot2).normalize();
          const dir3 = neckTop3.clone().sub(neckBot3).normalize();
          const neckQ2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir2);
          const zTilt = Math.atan2(dir3.z, Math.max(1e-6, Math.hypot(dir3.x, dir3.y)));
          const neckQuat = neckQ2.clone().multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -zTilt)
          );
          const neckCenter2 = neckBot2.clone().add(neckTop2).multiplyScalar(0.5);
          const neckThick = Math.max(shoulderWidth * 0.2, worldWidth * 0.022);
          bundle.torso.neck.mesh.visible = boxRenderMode !== "off";
          applyTorsoBox(bundle.torso.neck, neckCenter2, neckQuat, neckThick, neckLength, neckThick);
        } else {
          bundle.torso.neck.mesh.visible = false;
        }
      } else {
        bundle.torso.neck.mesh.visible = false;
      }

      // ── 팔다리 실린더 ─────────────────────────────────────────────────
      const limbBaseThickness =
        Math.max(((shoulderWidth + hipWidth) / 2) * boxThickness * 0.5, worldWidth * 0.015);

      const setLimbByLookAt = (
        box: BoxVisual,
        startIdx: number,
        endIdx: number,
        thicknessFactor: number
      ) => {
        const s = pts[startIdx];
        const e = pts[endIdx];
        const manual = manualRef.current[box.key];
        if (!s || !e || !valid(s) || !valid(e)) {
          box.mesh.visible = false;
          return;
        }

        const s2 = toWorld2D(s), e2 = toWorld2D(e);
        const s3 = toWorld3D(s), e3 = toWorld3D(e);
        const length = s2.distanceTo(e2);
        if (length < worldHeight * 0.02) { box.mesh.visible = false; return; }

        const dir2 = e2.clone().sub(s2).normalize();
        const dir3 = e3.clone().sub(s3).normalize();
        if (dir2.lengthSq() < 1e-6) { box.mesh.visible = false; return; }

        const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir2);
        const zTilt = Math.atan2(dir3.z, Math.max(1e-6, Math.hypot(dir3.x, dir3.y)));
        const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -zTilt);
        const baseQuat = q2.clone().multiply(qTilt);

        const thick = Math.max(limbBaseThickness * thicknessFactor, worldWidth * 0.01);
        const basePos = s2.clone().add(e2).multiplyScalar(0.5);

        baseTransformsRef.current[box.key] = {
          position: basePos.clone(),
          quaternion: baseQuat.clone(),
          scale: new THREE.Vector3(thick, length, thick),
        };
        box.mesh.visible = boxRenderMode !== "off";

        if (isDraggingRef.current && currentSelectedKey === box.key) {
          return;
        }

        box.mesh.position.copy(basePos).add(manual.positionOffset);
        box.mesh.quaternion.copy(baseQuat).multiply(manual.rotationOffset);
        box.mesh.scale.set(
          thick * manual.scaleVec.x,
          length * manual.scaleVec.y,
          thick * manual.scaleVec.z
        );
      };

      setLimbByLookAt(bundle.limbs.leftUpperArm, LEFT_SHOULDER, LEFT_ELBOW, upperArmThickness);
      setLimbByLookAt(bundle.limbs.rightUpperArm, RIGHT_SHOULDER, RIGHT_ELBOW, upperArmThickness);
      setLimbByLookAt(bundle.limbs.leftLowerArm, LEFT_ELBOW, LEFT_WRIST, lowerArmThickness);
      setLimbByLookAt(bundle.limbs.rightLowerArm, RIGHT_ELBOW, RIGHT_WRIST, lowerArmThickness);
      setLimbByLookAt(bundle.limbs.leftThigh, LEFT_HIP, LEFT_KNEE, thighThickness);
      setLimbByLookAt(bundle.limbs.rightThigh, RIGHT_HIP, RIGHT_KNEE, thighThickness);
      setLimbByLookAt(bundle.limbs.leftCalf, LEFT_KNEE, LEFT_ANKLE, calfThickness);
      setLimbByLookAt(bundle.limbs.rightCalf, RIGHT_KNEE, RIGHT_ANKLE, calfThickness);

      const setJointSphere = (mesh: THREE.Mesh, idx: number) => {
        const p = pts[idx];
        if (!p || !valid(p)) { mesh.visible = false; return; }
        mesh.visible = boxRenderMode !== "off";
        mesh.position.copy(toWorld2D(p));
        const r = Math.max(limbBaseThickness * 0.45, worldWidth * 0.006);
        mesh.scale.setScalar(r);
      };

      setJointSphere(bundle.joints.leftElbow, LEFT_ELBOW);
      setJointSphere(bundle.joints.rightElbow, RIGHT_ELBOW);
      setJointSphere(bundle.joints.leftKnee, LEFT_KNEE);
      setJointSphere(bundle.joints.rightKnee, RIGHT_KNEE);

      applyRenderMode(currentSelectedKey);
    };

    // ── TransformControls (기즈모) 설정 ──────────────────────────────────
    const { controls: tc, destroy: destroyGizmo } = setupGizmoController({
      scene,
      camera,
      renderer,
      getAllBoxes,
      manualRef,
      baseTransformsRef,
      bundleRef,
      onModeChange: setGizmoMode,
      onSelectChange: setSelectedKey,
      onBoxUpdate,
      isDraggingRef,
      flashRef: flashSetterRef,
    });

    gizmoModeSetterRef.current = (mode: GizmoMode) => {
      tc.setMode(mode);
      setGizmoMode(mode);
    };

    // ── 렌더 루프 ─────────────────────────────────────────────────────────
    // selectedKey는 gizmoStateRef 내부에서 관리되어 클로저로 접근
    const gizmoSelectedRef = { current: null as BoxKey | null };
    // patch: gizmoController가 gizmoSelectedRef를 공유
    (tc as unknown as { _poseOverlaySelectedRef: typeof gizmoSelectedRef })
      ._poseOverlaySelectedRef = gizmoSelectedRef;

    const tick = () => {
      updateSize();
      updateMeshes(gizmoSelectedRef.current);
      renderer.render(scene, camera);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    tick();

    const resizeObserver = new ResizeObserver(() => updateSize());
    const img = imageRef.current;
    if (img) resizeObserver.observe(img);

    return () => {
      gizmoModeSetterRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      destroyGizmo();
      resizeObserver.disconnect();
      renderer.dispose();
      container.innerHTML = "";
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      bundleRef.current = null;
    };
  }, [
    showThree,
    boxOpacity,
    boxRenderMode,
    ribcageScale,
    ribHeightScale,
    waistScale,
    waistHeightScale,
    pelvisScale,
    pelvisHeightScale,
    boxThickness,
    upperArmThickness,
    lowerArmThickness,
    thighThickness,
    calfThickness,
    onBoxUpdate,
  ]);

  // ── JSX ──────────────────────────────────────────────────────────────────
  if (!imageSrc) return null;

  return (
    <div className="relative inline-block max-w-full overflow-hidden">
      <img
        ref={imageRef}
        src={imageSrc}
        alt="인체 드로잉 참조"
        className="max-h-[92vh] w-auto object-contain"
        style={{ filter: "contrast(1.05)" }}
      />

      {showSkeleton && (
        <canvas
          ref={skeletonCanvasRef}
          className="pointer-events-none absolute left-0 top-0"
          style={{ maxHeight: "92vh" }}
        />
      )}

      {showThree && (
        <div
          ref={threeLayerRef}
          className="absolute left-0 top-0"
          style={{ maxHeight: "92vh" }}
        />
      )}

      {/* 기즈모 모드 HUD */}
      {showThree && selectedKey && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {(["translate", "rotate", "scale"] as GizmoMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                gizmoModeSetterRef.current?.(mode);
              }}
              className={`rounded px-3 py-1.5 text-xs font-mono select-none touch-manipulation transition-transform duration-75 active:scale-90 ${
                flashKey === mode ? "scale-90 opacity-60" : "scale-100"
              } ${
                gizmoMode === mode
                  ? "bg-white/90 text-black"
                  : "bg-black/40 text-white/60"
              }`}
            >
              {GIZMO_MODE_LABEL[mode]}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              for (const key of ALL_BOX_KEYS) {
                manualRef.current[key].positionOffset.set(0, 0, 0);
                manualRef.current[key].rotationOffset.set(0, 0, 0, 1);
                manualRef.current[key].scaleVec.set(1, 1, 1);
              }
            }}
            className={`rounded px-3 py-1.5 text-xs font-mono select-none touch-manipulation bg-orange-500/80 text-white transition-transform duration-75 active:scale-90 ${flashKey === "q" ? "scale-90 opacity-60" : "scale-100"}`}
          >
            초기화 (Q)
          </button>
        </div>
      )}

      {showGuide && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-sm text-white">
          분석 중…
        </div>
      )}

      {showGuide && detectionAttempted && !loading && !error && !landmarks && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-black/60 px-5 py-3 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-white">포즈를 감지할 수 없습니다</p>
            <p className="mt-1 text-xs text-white/60">다른 사진을 선택해 주세요</p>
          </div>
        </div>
      )}

      {showGuide && error && !loading && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-red-500/90 px-3 py-1 text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}

// ── 기즈모 컨트롤러 (분리된 설정 함수) ─────────────────────────────────────
type GizmoControllerParams = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  getAllBoxes: () => BoxVisual[];
  manualRef: { current: Record<BoxKey, ManualTransform> };
  baseTransformsRef: { current: Partial<Record<BoxKey, BaseTransform>> };
  bundleRef: { current: SceneBundle | null };
  onModeChange: (mode: GizmoMode) => void;
  onSelectChange: (key: BoxKey | null) => void;
  onBoxUpdate?: (info: BoxUpdateInfo) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
  flashRef: React.MutableRefObject<((key: string) => void) | null>;
};

function setupGizmoController({
  scene,
  camera,
  renderer,
  getAllBoxes,
  manualRef,
  baseTransformsRef,
  bundleRef,
  onModeChange,
  onSelectChange,
  onBoxUpdate,
  isDraggingRef,
  flashRef,
}: GizmoControllerParams): { controls: TransformControls; destroy: () => void } {
  const tc = new TransformControls(camera, renderer.domElement);
  tc.setSize(0.8);
  scene.add(tc);

  let selectedKey: BoxKey | null = null;

  const handleDraggingChanged = (
    event: THREE.Event<"dragging-changed", TransformControls> & { value: unknown }
  ) => {
    const isDragging = !!event.value;
    isDraggingRef.current = isDragging;
    renderer.domElement.style.touchAction = isDragging ? "none" : "auto";

    // 드래그가 끝났을 때만 수동 보정값을 업데이트
    if (!isDragging && selectedKey) {
      const base = baseTransformsRef.current[selectedKey];
      const bundle = bundleRef.current;
      if (!base || !bundle) return;

      const box = getBoxVisualByKey(bundle, selectedKey);
      if (!box) return;
      const mesh = box.mesh;
      const manual = manualRef.current[selectedKey];

      // position: mesh.pos = basePos + offset  →  offset = mesh.pos - basePos
      manual.positionOffset.copy(mesh.position).sub(base.position);

      // quaternion: mesh.quat = baseQuat * rotOffset  →  rotOffset = baseQuat⁻¹ * mesh.quat
      manual.rotationOffset.copy(base.quaternion).invert().multiply(mesh.quaternion);

      // scale: mesh.scale = base.scale * scaleVec (component-wise)
      manual.scaleVec.set(
        base.scale.x !== 0 ? mesh.scale.x / base.scale.x : 1,
        base.scale.y !== 0 ? mesh.scale.y / base.scale.y : 1,
        base.scale.z !== 0 ? mesh.scale.z / base.scale.z : 1
      );

      onBoxUpdate?.({
        key: selectedKey,
        positionOffset: manual.positionOffset.clone(),
        rotationOffset: manual.rotationOffset.clone(),
        scaleVec: manual.scaleVec.clone(),
      });
    }
  };

  tc.addEventListener("dragging-changed", handleDraggingChanged);

  // ── 박스 클릭으로 선택 ────────────────────────────────────────────────
  const getPointerNdc = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if ((tc as any).axis) return;

    const ndc = getPointerNdc(event);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);

    const boxes = getAllBoxes();
    const targets = boxes.map((b) => b.mesh);
    const hits = raycaster.intersectObjects(targets, false);

    if (hits.length === 0) {
      if (selectedKey) {
        selectedKey = null;
        const tcAny = tc as unknown as { _poseOverlaySelectedRef?: { current: BoxKey | null } };
        if (tcAny._poseOverlaySelectedRef) tcAny._poseOverlaySelectedRef.current = null;
        tc.detach();
        onSelectChange(null);
      }
      return;
    }

    const picked = boxes.find((b) => b.mesh === hits[0].object);
    if (!picked) return;

    if (picked.key !== selectedKey) {
      selectedKey = picked.key;
      const tcAny = tc as unknown as { _poseOverlaySelectedRef?: { current: BoxKey | null } };
      if (tcAny._poseOverlaySelectedRef) {
        tcAny._poseOverlaySelectedRef.current = selectedKey;
      }
      tc.attach(picked.mesh);
      onSelectChange(selectedKey);
    }
  };


  // ── 키보드 단축키: T/R/S/Escape ──────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case "t":
        tc.setMode("translate");
        onModeChange("translate");
        flashRef.current?.("translate");
        break;
      case "r":
        tc.setMode("rotate");
        onModeChange("rotate");
        flashRef.current?.("rotate");
        break;
      case "s":
        tc.setMode("scale");
        onModeChange("scale");
        flashRef.current?.("scale");
        break;
      case "q":
        flashRef.current?.("q");
        for (const key of ALL_BOX_KEYS) {
          manualRef.current[key].positionOffset.set(0, 0, 0);
          manualRef.current[key].rotationOffset.set(0, 0, 0, 1);
          manualRef.current[key].scaleVec.set(1, 1, 1);
        }
        break;
      case "escape":
        selectedKey = null;
        const tcAny = tc as unknown as { _poseOverlaySelectedRef?: { current: BoxKey | null } };
        if (tcAny._poseOverlaySelectedRef) tcAny._poseOverlaySelectedRef.current = null;
        tc.detach();
        onSelectChange(null);
        break;
    }
  };

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("keydown", handleKeyDown);

  const destroy = () => {
    tc.removeEventListener("dragging-changed", handleDraggingChanged);
    renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("keydown", handleKeyDown);
    tc.detach();
    tc.dispose();
    scene.remove(tc);
  };

  return { controls: tc, destroy };
}
