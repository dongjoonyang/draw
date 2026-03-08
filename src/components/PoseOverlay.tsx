"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type PoseLandmarks = Array<{ x: number; y: number; z?: number }>;

type GuideMode = "none" | "skeleton" | "box";
type BoxRenderMode = "off" | "wire" | "solid";

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
};

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

type SceneBundle = {
  torso: { rib: BoxVisual; waist: BoxVisual; pelvis: BoxVisual };
  limbs: Record<LimbKey, BoxVisual>;
  joints: Record<string, THREE.Mesh>;
};

type BoxVisual = {
  key: BoxKey;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  midline?: THREE.Line;
  sideDiagonal?: THREE.Line;
  faceColor: number;
  edgeColor: number;
};

type TorsoKey = "rib" | "waist" | "pelvis";
type LimbKey =
  | "leftUpperArm"
  | "rightUpperArm"
  | "leftLowerArm"
  | "rightLowerArm"
  | "leftThigh"
  | "rightThigh"
  | "leftCalf"
  | "rightCalf";
type BoxKey = TorsoKey | LimbKey;

type ManualTransform = {
  positionOffset: THREE.Vector3;
  rotationOffset: THREE.Quaternion;
  scale: number;
};

const ALL_BOX_KEYS: BoxKey[] = [
  "rib",
  "waist",
  "pelvis",
  "leftUpperArm",
  "rightUpperArm",
  "leftLowerArm",
  "rightLowerArm",
  "leftThigh",
  "rightThigh",
  "leftCalf",
  "rightCalf",
];

function createManualMap(): Record<BoxKey, ManualTransform> {
  return ALL_BOX_KEYS.reduce((acc, key) => {
    acc[key] = {
      positionOffset: new THREE.Vector3(),
      rotationOffset: new THREE.Quaternion(),
      scale: 1,
    };
    return acc;
  }, {} as Record<BoxKey, ManualTransform>);
}

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
  const rafRef = useRef<number | null>(null);
  const manualRef = useRef<Record<BoxKey, ManualTransform>>(createManualMap());
  const interactionRef = useRef<{
    selected: BoxKey | null;
    dragging: boolean;
    rotating: boolean;
    lastPoint: THREE.Vector3 | null;
    lastX: number;
    lastY: number;
  }>({
    selected: null,
    dragging: false,
    rotating: false,
    lastPoint: null,
    lastX: 0,
    lastY: 0,
  });

  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showGuide = guideMode === "skeleton" || guideMode === "box";
  const showSkeleton = guideMode === "skeleton";
  const showThree = guideMode === "box" && enable3DBox;

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);

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
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
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
    }
  }, [showGuide, imageSrc]);

  useEffect(() => {
    manualRef.current = createManualMap();
    interactionRef.current.selected = null;
  }, [imageSrc]);

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

    const toCanvas = (x: number, y: number) => ({
      x: x * rect.width,
      y: y * rect.height,
    });

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

    const createBox = (key: BoxKey, opts?: {
      midline?: boolean;
      sideDiagonal?: boolean;
      faceColor?: number;
      edgeColor?: number;
      shape?: "box" | "cylinder";
    }): BoxVisual => {
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
      rib: createBox("rib", {
        midline: true,
        sideDiagonal: true,
        shape: "box",
        faceColor: 0xdbeafe,
        edgeColor: 0x1d4ed8,
      }),
      waist: createBox("waist", {
        midline: true,
        sideDiagonal: true,
        shape: "box",
        faceColor: 0xe9d5ff,
        edgeColor: 0x7e22ce,
      }),
      pelvis: createBox("pelvis", {
        midline: true,
        sideDiagonal: true,
        shape: "box",
        faceColor: 0xfef3c7,
        edgeColor: 0xb45309,
      }),
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

    const getAllMeshes = () => {
      const bundle = bundleRef.current;
      if (!bundle) return [] as THREE.Mesh[];
      return [
        bundle.torso.rib.mesh,
        bundle.torso.waist.mesh,
        bundle.torso.pelvis.mesh,
        ...Object.values(bundle.limbs).map((b) => b.mesh),
        ...Object.values(bundle.joints),
      ];
    };

    const getAllBoxes = () => {
      const bundle = bundleRef.current;
      if (!bundle) return [] as BoxVisual[];
      return [bundle.torso.rib, bundle.torso.waist, bundle.torso.pelvis, ...Object.values(bundle.limbs)];
    };

    const applyRenderMode = () => {
      const isOff = boxRenderMode === "off";
      const wire = boxRenderMode === "wire";
      const selected = interactionRef.current.selected;

      for (const box of getAllBoxes()) {
        box.mesh.visible = !isOff;
        const boxMat = box.mesh.material as THREE.MeshBasicMaterial;
        boxMat.opacity = wire ? Math.min(0.35, boxOpacity * 0.45) : Math.min(0.75, boxOpacity);
        boxMat.color.setHex(box.faceColor);
        boxMat.needsUpdate = true;

        const lineParts = [box.edges, box.midline, box.sideDiagonal].filter(
          Boolean
        ) as Array<THREE.Line | THREE.LineSegments>;
        for (const part of lineParts) {
          part.visible = !isOff;
          const lineMat = part.material as THREE.LineBasicMaterial;
          const isSelected = selected === box.key;
          lineMat.color.setHex(isSelected ? 0xff2d2d : box.edgeColor);
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

    const getPointerNdc = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const getPlanePoint = (event: PointerEvent, planeZ = 0) => {
      if (!cameraRef.current) return null;
      const ndc = getPointerNdc(event);
      const origin = new THREE.Vector3(ndc.x, ndc.y, -1).unproject(cameraRef.current);
      const far = new THREE.Vector3(ndc.x, ndc.y, 1).unproject(cameraRef.current);
      const direction = far.sub(origin).normalize();
      if (Math.abs(direction.z) < 1e-6) return null;
      const t = (planeZ - origin.z) / direction.z;
      return origin.add(direction.multiplyScalar(t));
    };

    const pickBox = (event: PointerEvent): BoxKey | null => {
      if (!cameraRef.current || !bundleRef.current) return null;
      const ndc = getPointerNdc(event);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), cameraRef.current);
      const targets = getAllBoxes().map((b) => b.mesh);
      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) return null;
      const picked = getAllBoxes().find((b) => b.mesh === hits[0].object);
      return picked?.key ?? null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (boxRenderMode === "off") return;
      const selected = pickBox(event);
      interactionRef.current.selected = selected;
      if (!selected) return;

      if (event.button === 0) {
        interactionRef.current.dragging = true;
        interactionRef.current.rotating = false;
        interactionRef.current.lastPoint = getPlanePoint(event, 0);
      } else if (event.button === 2) {
        interactionRef.current.rotating = true;
        interactionRef.current.dragging = false;
        interactionRef.current.lastX = event.clientX;
        interactionRef.current.lastY = event.clientY;
      }
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = interactionRef.current;
      const key = state.selected;
      if (!key) return;
      const manual = manualRef.current[key];

      if (state.dragging) {
        const point = getPlanePoint(event, 0);
        if (!point || !state.lastPoint) return;
        const delta = point.clone().sub(state.lastPoint);
        manual.positionOffset.add(delta);
        state.lastPoint = point;
      } else if (state.rotating) {
        const dx = event.clientX - state.lastX;
        const dy = event.clientY - state.lastY;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        const qYaw = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          dx * 0.01
        );
        const qPitch = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          dy * 0.01
        );
        manual.rotationOffset.multiply(qYaw).multiply(qPitch);
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      interactionRef.current.dragging = false;
      interactionRef.current.rotating = false;
      interactionRef.current.lastPoint = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const onWheel = (event: WheelEvent) => {
      const key = pickBox(event as unknown as PointerEvent) ?? interactionRef.current.selected;
      if (!key) return;
      event.preventDefault();
      const manual = manualRef.current[key];
      const next = manual.scale + (event.deltaY < 0 ? 0.05 : -0.05);
      manual.scale = Math.max(0.55, Math.min(1.8, next));
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const updateSize = () => {
      const img = imageRef.current;
      if (!img || !cameraRef.current || !rendererRef.current) return;

      const rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      container.style.width = `${rect.width}px`;
      container.style.height = `${rect.height}px`;
      rendererRef.current.setSize(rect.width, rect.height, false);
      cameraRef.current.aspect = rect.width / rect.height;

      const worldHeight = 2;
      const fovRad = (cameraRef.current.fov * Math.PI) / 180;
      cameraRef.current.position.z = (worldHeight / 2) / Math.tan(fovRad / 2);
      cameraRef.current.updateProjectionMatrix();
    };

    const updateMeshes = () => {
      const pts = landmarksRef.current;
      const bundle = bundleRef.current;
      const img = imageRef.current;
      if (!pts || !bundle || !img) return;

      const ls = pts[LEFT_SHOULDER];
      const rs = pts[RIGHT_SHOULDER];
      const lh = pts[LEFT_HIP];
      const rh = pts[RIGHT_HIP];
      if (!ls || !rs || !lh || !rh) return;

      const rect = img.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const aspect = rect.width / rect.height;
      const worldHeight = 2;
      const worldWidth = worldHeight * aspect;
      const depthScale = worldWidth * 0.22;
      const valid = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

      const toWorld2D = (p: { x: number; y: number }) =>
        new THREE.Vector3((p.x - 0.5) * worldWidth, (0.5 - p.y) * worldHeight, 0);
      const toWorld3D = (p: { x: number; y: number; z?: number }) =>
        new THREE.Vector3(
          (p.x - 0.5) * worldWidth,
          (0.5 - p.y) * worldHeight,
          -(p.z ?? 0) * depthScale
        );

      const pLS2 = toWorld2D(ls);
      const pRS2 = toWorld2D(rs);
      const pLH2 = toWorld2D(lh);
      const pRH2 = toWorld2D(rh);

      const pLS3 = toWorld3D(ls);
      const pRS3 = toWorld3D(rs);
      const pLH3 = toWorld3D(lh);
      const pRH3 = toWorld3D(rh);

      const shoulderMid2 = pLS2.clone().add(pRS2).multiplyScalar(0.5);
      const hipMid2 = pLH2.clone().add(pRH2).multiplyScalar(0.5);
      const shoulderMid3 = pLS3.clone().add(pRS3).multiplyScalar(0.5);
      const hipMid3 = pLH3.clone().add(pRH3).multiplyScalar(0.5);

      const upAxis = shoulderMid3.clone().sub(hipMid3).normalize();
      const rawLateral = pRS3.clone().sub(pLS3);
      if (rawLateral.lengthSq() < 1e-6) return;

      let forwardAxis = rawLateral.clone().cross(upAxis).normalize();
      if (forwardAxis.lengthSq() < 1e-6) {
        forwardAxis = new THREE.Vector3(0, 0, 1);
      }
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

      const ribHeight = Math.max(torsoLength * 0.4, worldHeight * 0.11) * ribHeightScale;
      const ribShoulderLift = torsoLength * 0.08;
      const ribCenter = shoulderMid2
        .clone()
        .add(torsoUp2.clone().multiplyScalar(ribShoulderLift - ribHeight * 0.5));
      const ribDepth = Math.max(shoulderWidth * boxThickness * 1.35, worldWidth * 0.055);

      const waistHeight = Math.max(torsoLength * 0.25, worldHeight * 0.09) * waistHeightScale;
      const waistCenter = shoulderMid2.clone().lerp(hipMid2, 0.56);
      const waistWidth = shoulderWidth * 0.72 + hipWidth * 0.28;
      const waistDepth = Math.max(((shoulderWidth + hipWidth) * 0.5) * boxThickness * 1.12, worldWidth * 0.045);
      const waistYaw = shoulderYaw * 0.45 + hipYaw * 0.55;
      const waistRotation = torsoBaseRotation
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(upAxis, waistYaw));

      const pelvisHeight = Math.max(torsoLength * 0.33, worldHeight * 0.12) * pelvisHeightScale;
      const pelvisCenter = hipMid2.clone().add(torsoUp2.clone().multiplyScalar(pelvisHeight * 0.5));
      const pelvisDepth = Math.max(hipWidth * boxThickness * 1.7, worldWidth * 0.065);

      const ribManual = manualRef.current.rib;
      const waistManual = manualRef.current.waist;
      const pelvisManual = manualRef.current.pelvis;

      bundle.torso.rib.mesh.position.copy(ribCenter).add(ribManual.positionOffset);
      bundle.torso.rib.mesh.quaternion.copy(ribRotation).multiply(ribManual.rotationOffset);
      bundle.torso.rib.mesh.scale.set(
        Math.max(shoulderWidth * ribcageScale, worldWidth * 0.08),
        ribHeight,
        ribDepth
      ).multiplyScalar(ribManual.scale);

      bundle.torso.waist.mesh.position.copy(waistCenter).add(waistManual.positionOffset);
      bundle.torso.waist.mesh.quaternion.copy(waistRotation).multiply(waistManual.rotationOffset);
      bundle.torso.waist.mesh.scale.set(
        Math.max(waistWidth * waistScale, worldWidth * 0.07),
        waistHeight,
        waistDepth
      ).multiplyScalar(waistManual.scale);

      bundle.torso.pelvis.mesh.position.copy(pelvisCenter).add(pelvisManual.positionOffset);
      bundle.torso.pelvis.mesh.quaternion.copy(pelvisRotation).multiply(pelvisManual.rotationOffset);
      bundle.torso.pelvis.mesh.scale.set(
        Math.max(hipWidth * pelvisScale, worldWidth * 0.08),
        pelvisHeight,
        pelvisDepth
      ).multiplyScalar(pelvisManual.scale);

      const limbBaseThickness = Math.max(((shoulderWidth + hipWidth) / 2) * boxThickness * 0.5, worldWidth * 0.015);

      const setLimbByLookAt = (box: BoxVisual, startIdx: number, endIdx: number, thicknessFactor: number) => {
        const s = pts[startIdx];
        const e = pts[endIdx];
        const manual = manualRef.current[box.key];
        if (!s || !e || !valid(s) || !valid(e)) {
          box.mesh.visible = false;
          return;
        }

        const s2 = toWorld2D(s);
        const e2 = toWorld2D(e);
        const s3 = toWorld3D(s);
        const e3 = toWorld3D(e);

        const length = s2.distanceTo(e2);
        if (length < worldHeight * 0.02) {
          box.mesh.visible = false;
          return;
        }

        box.mesh.visible = boxRenderMode !== "off";
        box.mesh.position.copy(s2.clone().add(e2).multiplyScalar(0.5)).add(manual.positionOffset);

        const dir2 = e2.clone().sub(s2).normalize();
        const dir3 = e3.clone().sub(s3).normalize();
        if (dir2.lengthSq() < 1e-6) {
          box.mesh.visible = false;
          return;
        }
        const q2 = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir2
        );
        const zTilt = Math.atan2(dir3.z, Math.max(1e-6, Math.hypot(dir3.x, dir3.y)));
        const qTilt = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          -zTilt
        );
        box.mesh.quaternion.copy(q2.multiply(qTilt)).multiply(manual.rotationOffset);

        const thick = Math.max(limbBaseThickness * thicknessFactor, worldWidth * 0.01);
        box.mesh.scale.set(thick, length, thick).multiplyScalar(manual.scale);
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
        if (!p || !valid(p)) {
          mesh.visible = false;
          return;
        }
        mesh.visible = boxRenderMode !== "off";
        mesh.position.copy(toWorld2D(p));
        const r = Math.max(limbBaseThickness * 0.45, worldWidth * 0.006);
        mesh.scale.setScalar(r);
      };

      setJointSphere(bundle.joints.leftElbow, LEFT_ELBOW);
      setJointSphere(bundle.joints.rightElbow, RIGHT_ELBOW);
      setJointSphere(bundle.joints.leftKnee, LEFT_KNEE);
      setJointSphere(bundle.joints.rightKnee, RIGHT_KNEE);

      applyRenderMode();
    };

    const tick = () => {
      updateSize();
      updateMeshes();
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    tick();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    const img = imageRef.current;
    if (img) resizeObserver.observe(img);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
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
  ]);

  if (!imageSrc) return null;

  return (
    <div className="relative inline-block max-w-full overflow-hidden">
      <img
        ref={imageRef}
        src={imageSrc}
        alt="인체 드로잉 참조"
        className="max-h-[92vh] w-auto object-contain"
        style={{ filter: "grayscale(100%) contrast(1.1)" }}
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
          className="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
          style={{ maxHeight: "92vh" }}
        />
      )}

      {showGuide && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-sm text-white">
          분석 중…
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
