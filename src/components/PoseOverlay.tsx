"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
  /** 회전 오프셋의 오일러 각도 (도 단위) */
  rotEulerDeg: { x: number; y: number; z: number };
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
  headScale?: number;
  headHeightScale?: number;
  boxThickness?: number;
  upperArmThickness?: number;
  lowerArmThickness?: number;
  thighThickness?: number;
  calfThickness?: number;
  onLandmarks?: (landmarks: PoseLandmarks | null) => void;
  /** 기즈모로 박스 변환 시 부모에게 변경값 전달 (드래그 종료 시) */
  onBoxUpdate?: (info: BoxUpdateInfo) => void;
  /** 기즈모 드래그 중 실시간 변환값 전달 */
  onBoxChange?: (info: BoxUpdateInfo) => void;
  /** 선택된 박스 키 변경 시 부모에게 전달 */
  onSelectedKeyChange?: (key: BoxKey | null) => void;
  /** CSS transform scale 값 (기본 1) */
  zoom?: number;
  /** 기즈모 모드 변경 시 부모에게 전달 */
  onGizmoModeChange?: (mode: GizmoMode) => void;
  /** 키보드 단축키 또는 액션 발생 시 부모에게 전달 ("translate"|"rotate"|"scale"|"delete"|"reset") */
  onAction?: (key: string) => void;
};

export type PoseOverlayHandle = {
  deleteSelected: () => void;
  resetHidden: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  resetScaleForKey: (key: BoxKey) => void;
  absorbScale: (key: BoxKey, sx: number, sy: number) => void;
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
type TorsoKey = "rib" | "waist" | "pelvis" | "head";
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
  torso: { rib: BoxVisual; waist: BoxVisual; pelvis: BoxVisual; head: BoxVisual };
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
  "rib", "waist", "pelvis", "head",
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
  if (key === "rib") return bundle.torso.rib;
  if (key === "waist") return bundle.torso.waist;
  if (key === "pelvis") return bundle.torso.pelvis;
  if (key === "head") return bundle.torso.head;
  return (bundle.limbs as Record<string, BoxVisual>)[key] ?? null;
}

// ── Gizmo 모드 레이블 ────────────────────────────────────────────────────────
const GIZMO_MODE_LABEL: Record<GizmoMode, string> = {
  translate: "이동 (T)",
  rotate: "회전 (R)",
  scale: "스케일 (S)",
};

// ── Component ────────────────────────────────────────────────────────────────
const PoseOverlay = forwardRef<PoseOverlayHandle, Props>(function PoseOverlay({
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
  headScale = 1,
  headHeightScale = 1,
  boxThickness = 0.4,
  upperArmThickness = 0.9,
  lowerArmThickness = 0.78,
  thighThickness = 1,
  calfThickness = 0.88,
  onLandmarks,
  onBoxUpdate,
  onBoxChange,
  onSelectedKeyChange,
  onGizmoModeChange,
  onAction,
  zoom = 1,
}: Props, ref) {
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
  const hiddenKeysRef = useRef<Set<BoxKey>>(new Set());
  const validLandmarkKeysRef = useRef<Set<BoxKey>>(new Set());
  const currentSelectedKeyRef = useRef<BoxKey | null>(null);
  const triggerDeleteRef = useRef<((key: BoxKey) => void) | null>(null);
  const triggerResetHiddenRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const ribcageScaleRef = useRef(ribcageScale);
  ribcageScaleRef.current = ribcageScale;
  const ribHeightScaleRef = useRef(ribHeightScale);
  ribHeightScaleRef.current = ribHeightScale;
  const waistScaleRef = useRef(waistScale);
  waistScaleRef.current = waistScale;
  const waistHeightScaleRef = useRef(waistHeightScale);
  waistHeightScaleRef.current = waistHeightScale;
  const pelvisScaleRef = useRef(pelvisScale);
  pelvisScaleRef.current = pelvisScale;
  const pelvisHeightScaleRef = useRef(pelvisHeightScale);
  pelvisHeightScaleRef.current = pelvisHeightScale;
  const headScaleRef = useRef(headScale);
  headScaleRef.current = headScale;
  const headHeightScaleRef = useRef(headHeightScale);
  headHeightScaleRef.current = headHeightScale;
  const boxThicknessRef = useRef(boxThickness);
  boxThicknessRef.current = boxThickness;
  const upperArmThicknessRef = useRef(upperArmThickness);
  upperArmThicknessRef.current = upperArmThickness;
  const lowerArmThicknessRef = useRef(lowerArmThickness);
  lowerArmThicknessRef.current = lowerArmThickness;
  const thighThicknessRef = useRef(thighThickness);
  thighThicknessRef.current = thighThickness;
  const calfThicknessRef = useRef(calfThickness);
  calfThicknessRef.current = calfThickness;
  const boxOpacityRef = useRef(boxOpacity);
  boxOpacityRef.current = boxOpacity;
  const boxRenderModeRef = useRef(boxRenderMode);
  boxRenderModeRef.current = boxRenderMode;
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

  useImperativeHandle(ref, () => ({
    deleteSelected: () => {
      const key = currentSelectedKeyRef.current;
      if (key) triggerDeleteRef.current?.(key);
    },
    resetHidden: () => {
      triggerResetHiddenRef.current?.();
      for (const key of ALL_BOX_KEYS) {
        manualRef.current[key].positionOffset.set(0, 0, 0);
        manualRef.current[key].rotationOffset.set(0, 0, 0, 1);
        manualRef.current[key].scaleVec.set(1, 1, 1);
      }
    },
    setGizmoMode: (mode: GizmoMode) => {
      gizmoModeSetterRef.current?.(mode);
    },
    resetScaleForKey: (key: BoxKey) => {
      manualRef.current[key].scaleVec.set(1, 1, 1);
    },
    absorbScale: (key: BoxKey, sx: number, sy: number) => {
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      switch (key) {
        case "rib":
          ribcageScaleRef.current = clamp(ribcageScaleRef.current * sx, 0.7, 1.5);
          ribHeightScaleRef.current = clamp(ribHeightScaleRef.current * sy, 0.6, 1.6);
          break;
        case "waist":
          waistScaleRef.current = clamp(waistScaleRef.current * sx, 0.7, 1.5);
          waistHeightScaleRef.current = clamp(waistHeightScaleRef.current * sy, 0.6, 1.6);
          break;
        case "pelvis":
          pelvisScaleRef.current = clamp(pelvisScaleRef.current * sx, 0.7, 1.5);
          pelvisHeightScaleRef.current = clamp(pelvisHeightScaleRef.current * sy, 0.6, 1.6);
          break;
        case "head":
          headScaleRef.current = clamp(headScaleRef.current * sx, 0.5, 2.0);
          headHeightScaleRef.current = clamp(headHeightScaleRef.current * sy, 0.5, 2.0);
          break;
        case "leftUpperArm":
        case "rightUpperArm":
          upperArmThicknessRef.current = clamp(upperArmThicknessRef.current * sx, 0.5, 1.4);
          break;
        case "leftLowerArm":
        case "rightLowerArm":
          lowerArmThicknessRef.current = clamp(lowerArmThicknessRef.current * sx, 0.5, 1.4);
          break;
        case "leftThigh":
        case "rightThigh":
          thighThicknessRef.current = clamp(thighThicknessRef.current * sx, 0.5, 1.4);
          break;
        case "leftCalf":
        case "rightCalf":
          calfThicknessRef.current = clamp(calfThicknessRef.current * sx, 0.5, 1.4);
          break;
      }
      manualRef.current[key].scaleVec.set(1, 1, 1);
    },
  }));
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const flashSetterRef = useRef<((key: string) => void) | null>(null);
  flashSetterRef.current = (key: string) => {
    onActionRef.current?.(key);
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

        // HTMLImageElement 대신 Canvas로 감싸서 전달 →
        // MediaPipe가 정확한 이미지 크기(naturalWidth×naturalHeight)를 인식하여
        // "Using NORM_RECT without IMAGE_DIMENSIONS" 경고 및 비정사각형 좌표 오류 해소
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const result = poseLandmarker.detect(canvas);
        poseLandmarker.close();

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

    const w = img.offsetWidth;
    const h = img.offsetHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const scale = Math.min(w, h) / 500;
    const toCanvas = (x: number, y: number) => ({ x: x * w, y: y * h });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isVisible = (pt: { x: number; y: number } | undefined) =>
      pt && pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1;

    // 색상·굵기별 연결선 그룹
    const GROUPS = [
      // 몸통 (초록)
      { color: "#69F0AE", width: 3.5, pairs: [[11,12],[11,23],[12,24],[23,24]] },
      // 척추 중심선 (밝은 초록)
      { color: "#B9F6CA", width: 2, pairs: [[11,12]] },
      // 왼팔 (하늘색) — MediaPipe 왼쪽=화면 왼쪽
      { color: "#40C4FF", width: 3, pairs: [[11,13],[13,15]] },
      { color: "#80D8FF", width: 1.5, pairs: [[15,17],[15,19],[15,21],[17,19]] },
      // 오른팔 (분홍)
      { color: "#FF80AB", width: 3, pairs: [[12,14],[14,16]] },
      { color: "#FFCCDD", width: 1.5, pairs: [[16,18],[16,20],[16,22],[18,20]] },
      // 왼다리 (주황)
      { color: "#FFD740", width: 3.5, pairs: [[23,25],[25,27]] },
      { color: "#FFE57F", width: 1.5, pairs: [[27,29],[27,31],[29,31]] },
      // 오른다리 (보라)
      { color: "#EA80FC", width: 3.5, pairs: [[24,26],[26,28]] },
      { color: "#F3B8FF", width: 1.5, pairs: [[28,30],[28,32],[30,32]] },
      // 얼굴 (노란)
      { color: "#FFD740", width: 1.2, pairs: [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10]] },
    ];

    // 관절 표시할 주요 랜드마크 인덱스
    const JOINT_INDICES = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    const drawPass = (shadowMode: boolean) => {
      for (const group of GROUPS) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (shadowMode) {
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.lineWidth = (group.width + 2) * scale;
        } else {
          ctx.strokeStyle = group.color;
          ctx.lineWidth = group.width * scale;
        }

        for (const [si, ei] of group.pairs) {
          const a = landmarks[si];
          const b = landmarks[ei];
          if (!isVisible(a) || !isVisible(b)) continue;
          const p1 = toCanvas(a.x, a.y);
          const p2 = toCanvas(b.x, b.y);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    };

    // 1패스: 그림자
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(1.5 * scale, 1.5 * scale);
    drawPass(true);
    ctx.restore();

    // 2패스: 컬러 선
    drawPass(false);

    // 3패스: 관절 원
    for (const idx of JOINT_INDICES) {
      const pt = landmarks[idx];
      if (!isVisible(pt)) continue;
      const p = toCanvas(pt.x, pt.y);
      const r = 3.5 * scale;
      // 외곽 검정
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 1.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fill();
      // 흰 원
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
    }
  }, [landmarks, showSkeleton, zoom]);

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
          opacity: boxOpacityRef.current,
          side: THREE.DoubleSide,
        })
      );

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacityRef.current })
      );
      mesh.add(edges);

      let midline: THREE.Line | undefined;
      if (opts?.midline) {
        midline = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.5, 0.501),
            new THREE.Vector3(0, -0.5, 0.501),
          ]),
          new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacityRef.current })
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
          new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: boxOpacityRef.current })
        );
        mesh.add(sideDiagonal);
      }

      scene.add(mesh);
      return { key, mesh, edges, midline, sideDiagonal, faceColor, edgeColor };
    };

    const torso = {
      rib: createBox("rib", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xdbeafe, edgeColor: 0x1d4ed8 }),
      waist: createBox("waist", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xe9d5ff, edgeColor: 0x7e22ce }),
      pelvis: createBox("pelvis", { midline: true, sideDiagonal: true, shape: "box", faceColor: 0xfef3c7, edgeColor: 0xb45309 }),
      head: createBox("head", { midline: false, sideDiagonal: false, shape: "box", faceColor: 0xfce7f3, edgeColor: 0xbe185d }),
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
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: boxOpacityRef.current })
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
      return [b.torso.rib, b.torso.waist, b.torso.pelvis, b.torso.head, ...Object.values(b.limbs)];
    };

    // ── 렌더 모드 적용 ────────────────────────────────────────────────────
    const applyRenderMode = (currentSelectedKey: BoxKey | null) => {
      const isOff = boxRenderModeRef.current === "off";
      const wire = boxRenderModeRef.current === "wire";

      for (const box of getAllBoxes()) {
        box.mesh.visible = !isOff && !hiddenKeysRef.current.has(box.key) && validLandmarkKeysRef.current.has(box.key);
        const boxMat = box.mesh.material as THREE.MeshBasicMaterial;
        boxMat.opacity = wire ? Math.min(0.35, boxOpacityRef.current * 0.45) : Math.min(0.75, boxOpacityRef.current);
        boxMat.color.setHex(box.faceColor);
        boxMat.needsUpdate = true;

        const lineParts = [box.edges, box.midline, box.sideDiagonal].filter(Boolean) as Array<
          THREE.Line | THREE.LineSegments
        >;
        const lineVisible = !isOff && !hiddenKeysRef.current.has(box.key) && validLandmarkKeysRef.current.has(box.key);
        for (const part of lineParts) {
          part.visible = lineVisible;
          const lineMat = part.material as THREE.LineBasicMaterial;
          lineMat.color.setHex(currentSelectedKey === box.key ? 0xff2d2d : box.edgeColor);
          lineMat.opacity = boxOpacityRef.current;
          lineMat.needsUpdate = true;
        }
      }

      for (const mesh of Object.values(bundleRef.current?.joints ?? {})) {
        mesh.visible = !isOff;
        const m = mesh.material as THREE.MeshBasicMaterial;
        m.color.setHex(0xffe45e);
        m.opacity = Math.min(1, boxOpacityRef.current + 0.1);
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

      // 매 프레임 초기화 — 실제 랜드마크가 유효한 박스만 누적
      validLandmarkKeysRef.current.clear();

      const ls = pts[LEFT_SHOULDER];
      const rs = pts[RIGHT_SHOULDER];
      const lh = pts[LEFT_HIP];
      const rh = pts[RIGHT_HIP];

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

      // ── 머리 박스 (어깨+코만 있으면 표시) ────────────────────────────────
      const nose = pts[NOSE];
      if (ls && rs && valid(ls) && valid(rs) && nose && valid(nose)) {
        const pLS2h = toWorld2D(ls), pRS2h = toWorld2D(rs);
        const pLS3h = toWorld3D(ls), pRS3h = toWorld3D(rs);
        const nosePos2 = toWorld2D(nose);
        const shoulderWidthH = pLS2h.distanceTo(pRS2h);
        const baseHeadW = Math.min(shoulderWidthH * 0.30, worldWidth * 0.14);
        const headW = Math.max(baseHeadW * headScaleRef.current, worldWidth * 0.05);
        const baseHeadH = Math.min(shoulderWidthH * 0.38, worldHeight * 0.16);
        const headH = Math.max(baseHeadH * headHeightScaleRef.current, worldHeight * 0.06);
        const headD = Math.min(shoulderWidthH * 0.28, worldWidth * 0.12);
        const rawLateralH = pRS3h.clone().sub(pLS3h);
        const headUpAxis = new THREE.Vector3(0, 1, 0);
        let headForwardAxis = rawLateralH.clone().cross(headUpAxis).normalize();
        if (headForwardAxis.lengthSq() < 1e-6) headForwardAxis = new THREE.Vector3(0, 0, 1);
        const headLateralAxis = headUpAxis.clone().cross(headForwardAxis).normalize();
        const headQuat = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(headLateralAxis, headUpAxis, headForwardAxis)
        );
        const headCenter = nosePos2.clone().add(new THREE.Vector3(0, headH * 0.1, 0));
        bundle.torso.head.mesh.visible = boxRenderModeRef.current !== "off";
        validLandmarkKeysRef.current.add("head");
        const headManual = manualRef.current["head"];
        baseTransformsRef.current["head"] = { position: headCenter.clone(), quaternion: headQuat.clone(), scale: new THREE.Vector3(headW, headH, headD) };
        if (!(isDraggingRef.current && currentSelectedKey === "head")) {
          bundle.torso.head.mesh.position.copy(headCenter).add(headManual.positionOffset);
          bundle.torso.head.mesh.quaternion.copy(headQuat).multiply(headManual.rotationOffset);
          bundle.torso.head.mesh.scale.set(headW * headManual.scaleVec.x, headH * headManual.scaleVec.y, headD * headManual.scaleVec.z);
        }
      } else {
        bundle.torso.head.mesh.visible = false;
      }

      if (!ls || !rs || !lh || !rh) {
        applyRenderMode(currentSelectedKey);
        return;
      }

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
        validLandmarkKeysRef.current.add(box.key);
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

      const ribHeight = Math.max(torsoLength * 0.4, worldHeight * 0.11) * ribHeightScaleRef.current;
      const ribShoulderLift = torsoLength * 0.08;
      const ribCenter = shoulderMid2.clone().add(torsoUp2.clone().multiplyScalar(ribShoulderLift - ribHeight * 0.5));
      const ribDepth = Math.max(shoulderWidth * boxThicknessRef.current * 1.35, worldWidth * 0.055);
      applyTorsoBox(
        bundle.torso.rib,
        ribCenter, ribRotation,
        Math.max(shoulderWidth * ribcageScaleRef.current, worldWidth * 0.08),
        ribHeight, ribDepth
      );

      const waistHeight = Math.max(torsoLength * 0.25, worldHeight * 0.09) * waistHeightScaleRef.current;
      const waistCenter = shoulderMid2.clone().lerp(hipMid2, 0.56);
      const waistWidth = shoulderWidth * 0.72 + hipWidth * 0.28;
      const waistDepth = Math.max(((shoulderWidth + hipWidth) * 0.5) * boxThicknessRef.current * 1.12, worldWidth * 0.045);
      const waistYaw = shoulderYaw * 0.45 + hipYaw * 0.55;
      const waistRotation = torsoBaseRotation
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, waistYaw));
      applyTorsoBox(
        bundle.torso.waist,
        waistCenter, waistRotation,
        Math.max(waistWidth * waistScaleRef.current, worldWidth * 0.07),
        waistHeight, waistDepth
      );

      const pelvisHeight = Math.max(torsoLength * 0.33, worldHeight * 0.12) * pelvisHeightScaleRef.current;
      const pelvisCenter = hipMid2.clone().add(torsoUp2.clone().multiplyScalar(pelvisHeight * 0.5));
      const pelvisDepth = Math.max(hipWidth * boxThicknessRef.current * 1.7, worldWidth * 0.065);
      applyTorsoBox(
        bundle.torso.pelvis,
        pelvisCenter, pelvisRotation,
        Math.max(hipWidth * pelvisScaleRef.current, worldWidth * 0.08),
        pelvisHeight, pelvisDepth
      );

      // ── 팔다리 실린더 ─────────────────────────────────────────────────
      const limbBaseThickness =
        Math.max(((shoulderWidth + hipWidth) / 2) * boxThicknessRef.current * 0.5, worldWidth * 0.015);

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
        box.mesh.visible = boxRenderModeRef.current !== "off";
        validLandmarkKeysRef.current.add(box.key);

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

      setLimbByLookAt(bundle.limbs.leftUpperArm, LEFT_SHOULDER, LEFT_ELBOW, upperArmThicknessRef.current);
      setLimbByLookAt(bundle.limbs.rightUpperArm, RIGHT_SHOULDER, RIGHT_ELBOW, upperArmThicknessRef.current);
      setLimbByLookAt(bundle.limbs.leftLowerArm, LEFT_ELBOW, LEFT_WRIST, lowerArmThicknessRef.current);
      setLimbByLookAt(bundle.limbs.rightLowerArm, RIGHT_ELBOW, RIGHT_WRIST, lowerArmThicknessRef.current);
      setLimbByLookAt(bundle.limbs.leftThigh, LEFT_HIP, LEFT_KNEE, thighThicknessRef.current);
      setLimbByLookAt(bundle.limbs.rightThigh, RIGHT_HIP, RIGHT_KNEE, thighThicknessRef.current);
      setLimbByLookAt(bundle.limbs.leftCalf, LEFT_KNEE, LEFT_ANKLE, calfThicknessRef.current);
      setLimbByLookAt(bundle.limbs.rightCalf, RIGHT_KNEE, RIGHT_ANKLE, calfThicknessRef.current);

      const setJointSphere = (mesh: THREE.Mesh, idx: number) => {
        const p = pts[idx];
        if (!p || !valid(p)) { mesh.visible = false; return; }
        mesh.visible = boxRenderModeRef.current !== "off";
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
      onModeChange: (mode) => { setGizmoMode(mode); onGizmoModeChange?.(mode); },
      onSelectChange: (key) => { currentSelectedKeyRef.current = key; setSelectedKey(key); },
      onBoxUpdate,
      onBoxChange,
      isDraggingRef,
      flashRef: flashSetterRef,
      hiddenKeysRef,
      currentSelectedKeyRef,
    });

    gizmoModeSetterRef.current = (mode: GizmoMode) => {
      tc.setMode(mode);
      setGizmoMode(mode);
      onGizmoModeChange?.(mode);
    };

    // ── 렌더 루프 ─────────────────────────────────────────────────────────
    // selectedKey는 gizmoStateRef 내부에서 관리되어 클로저로 접근
    const gizmoSelectedRef = { current: null as BoxKey | null };
    // patch: gizmoController가 gizmoSelectedRef를 공유
    (tc as unknown as { _poseOverlaySelectedRef: typeof gizmoSelectedRef })
      ._poseOverlaySelectedRef = gizmoSelectedRef;

    triggerDeleteRef.current = (key: BoxKey) => {
      hiddenKeysRef.current.add(key);
      const bundle = bundleRef.current;
      if (bundle) {
        const box = getBoxVisualByKey(bundle, key);
        if (box) box.mesh.visible = false;
      }
      gizmoSelectedRef.current = null;
      currentSelectedKeyRef.current = null;
      tc.detach();
      setSelectedKey(null);
    };

    triggerResetHiddenRef.current = () => {
      hiddenKeysRef.current.clear();
    };

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
    onBoxUpdate,
    onBoxChange,
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
});

export default PoseOverlay;

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
  onBoxChange?: (info: BoxUpdateInfo) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
  flashRef: React.MutableRefObject<((key: string) => void) | null>;
  hiddenKeysRef: React.MutableRefObject<Set<BoxKey>>;
  currentSelectedKeyRef: React.MutableRefObject<BoxKey | null>;
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
  onBoxChange,
  isDraggingRef,
  flashRef,
  hiddenKeysRef,
  currentSelectedKeyRef,
}: GizmoControllerParams): { controls: TransformControls; destroy: () => void } {
  const tc = new TransformControls(camera, renderer.domElement);
  tc.setSize(0.8);
  scene.add(tc);

  let selectedKey: BoxKey | null = null;

  const toEulerDeg = (q: THREE.Quaternion) => {
    const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
    const r2d = 180 / Math.PI;
    return { x: e.x * r2d, y: e.y * r2d, z: e.z * r2d };
  };

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
      let sx = base.scale.x !== 0 ? mesh.scale.x / base.scale.x : 1;
      const sy = base.scale.y !== 0 ? mesh.scale.y / base.scale.y : 1;
      let sz = base.scale.z !== 0 ? mesh.scale.z / base.scale.z : 1;

      // 팔다리(Limb)인 경우 너비(X)와 깊이(Z)를 동기화 (원통 유지)
      const isLimb = !["rib", "waist", "pelvis", "head"].includes(selectedKey);
      if (isLimb) {
        // 1.0(기본값)에서 더 많이 변화한 축의 값을 따름
        const devX = Math.abs(sx - 1);
        const devZ = Math.abs(sz - 1);
        if (devX > devZ) {
          sz = sx;
        } else {
          sx = sz;
        }
      }

      manual.scaleVec.set(sx, sy, sz);

      onBoxUpdate?.({
        key: selectedKey,
        positionOffset: manual.positionOffset.clone(),
        rotationOffset: manual.rotationOffset.clone(),
        scaleVec: manual.scaleVec.clone(),
        rotEulerDeg: toEulerDeg(manual.rotationOffset),
      });
    }
  };

  tc.addEventListener("dragging-changed", handleDraggingChanged);

  // ── 드래그 중 실시간 변환값 전달 ─────────────────────────────────────
  const handleChange = () => {
    if (!isDraggingRef.current || !selectedKey) return;
    
    // NOTE: 여기서는 mesh.scale을 강제로 수정하지 않음 (기즈모 동작 방해 방지)
    // 대신 드래그 종료 시(handleDraggingChanged) 동기화하여 저장함.

    const base = baseTransformsRef.current[selectedKey];
    const bundle = bundleRef.current;
    if (!base || !bundle) return;
    const box = getBoxVisualByKey(bundle, selectedKey);
    if (!box) return;
    const mesh = box.mesh;
    
    const posOffset = mesh.position.clone().sub(base.position);
    const rotOffset = base.quaternion.clone().invert().multiply(mesh.quaternion);
    const sv = new THREE.Vector3(
      base.scale.x !== 0 ? mesh.scale.x / base.scale.x : 1,
      base.scale.y !== 0 ? mesh.scale.y / base.scale.y : 1,
      base.scale.z !== 0 ? mesh.scale.z / base.scale.z : 1,
    );

    onBoxChange?.({ key: selectedKey, positionOffset: posOffset, rotationOffset: rotOffset, scaleVec: sv, rotEulerDeg: toEulerDeg(rotOffset) });
  };
  tc.addEventListener("change", handleChange);

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
        flashRef.current?.("reset");
        hiddenKeysRef.current.clear();
        for (const key of ALL_BOX_KEYS) {
          manualRef.current[key].positionOffset.set(0, 0, 0);
          manualRef.current[key].rotationOffset.set(0, 0, 0, 1);
          manualRef.current[key].scaleVec.set(1, 1, 1);
        }
        break;
      case "backspace": {
        const delKey = currentSelectedKeyRef.current ?? selectedKey;
        if (delKey) {
          flashRef.current?.("delete");
          hiddenKeysRef.current.add(delKey);
          const bundle = bundleRef.current;
          if (bundle) {
            const box = getBoxVisualByKey(bundle, delKey);
            if (box) box.mesh.visible = false;
          }
          const tcAnyDel = tc as unknown as { _poseOverlaySelectedRef?: { current: BoxKey | null } };
          if (tcAnyDel._poseOverlaySelectedRef) tcAnyDel._poseOverlaySelectedRef.current = null;
          selectedKey = null;
          currentSelectedKeyRef.current = null;
          tc.detach();
          onSelectChange(null);
        }
        break;
      }
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
    tc.removeEventListener("change", handleChange);
    renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
    window.removeEventListener("keydown", handleKeyDown);
    tc.detach();
    tc.dispose();
    scene.remove(tc);
  };

  return { controls: tc, destroy };
}
