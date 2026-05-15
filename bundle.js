(() => {
  "use strict";

  // ─────────────────────────────────────────────
  // ORBIT CONTROLLER COMPONENT
  // Manages tap-to-place + touch drag to orbit
  // ─────────────────────────────────────────────
  window.ecs.registerComponent({
    name: "orbit-controller",

    schema: {
      // Orbit speed (radians per pixel)
      orbitSpeed:    { type: "f32", default: 0.005 },
      // Min/max polar angle (vertical clamp)
      minPolar:      { type: "f32", default: 0.1 },
      maxPolar:      { type: "f32", default: Math.PI / 2.2 },
      // Orbit radius from target
      radius:        { type: "f32", default: 3.0 },
      // Target object name to orbit around
      targetName:    { type: "string", default: "chess.glb" },
    },

    add(world, component) {
      const data = component.data;

      // State
      let placed      = false;
      let targetPos   = { x: 0, y: 0, z: 0 };
      let theta       = 0;           // horizontal angle (azimuth)
      let phi         = Math.PI / 4; // vertical angle (polar)
      let lastTouch   = null;
      let touchId     = null;

      const hint     = document.getElementById("tap-hint");
      const resetBtn = document.getElementById("reset-btn");

      // ── Helpers ──────────────────────────────

      function setChessVisible(visible) {
        try {
          const objs = Object.values(world.ecs.application.getScene().objects || {});
          for (const obj of objs) {
            if (obj.name === data.targetName) {
              // 8th Wall ECS: toggle visibility via component or scale trick
              if (visible) {
                world.ecs.SceneObject.setScale(obj.id, 0.1, 0.1, 0.1);
              } else {
                world.ecs.SceneObject.setScale(obj.id, 0, 0, 0);
              }
              break;
            }
          }
        } catch (e) { /* silently ignore if not ready */ }
      }

      function applyOrbitCamera() {
        // Convert spherical → cartesian offset from target
        const r   = data.radius;
        const x   = targetPos.x + r * Math.sin(phi) * Math.sin(theta);
        const y   = targetPos.y + r * Math.cos(phi);
        const z   = targetPos.z + r * Math.sin(phi) * Math.cos(theta);

        world.ecs.Camera.setPosition(x, y, z);
        world.ecs.Camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
      }

      function placeChess(hitResult) {
        const pos = hitResult.position;
        targetPos = { x: pos[0], y: pos[1], z: pos[2] };

        // Move the chess glb to the hit point
        try {
          const scene = world.ecs.application.getScene();
          for (const [id, obj] of Object.entries(scene.objects || {})) {
            if (obj.name === data.targetName) {
              world.ecs.SceneObject.setPosition(id, pos[0], pos[1], pos[2]);
              world.ecs.SceneObject.setScale(id, 0.1, 0.1, 0.1);
              break;
            }
          }
        } catch (e) { console.warn("Could not place chess:", e); }

        placed = true;
        hint.classList.add("hidden");
        resetBtn.style.display = "block";
        applyOrbitCamera();
      }

      // ── Touch handlers ────────────────────────

      function onTouchStart(e) {
        if (!placed) return; // tap-to-place handled by AR hit-test
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId   = t.identifier;
        lastTouch = { x: t.clientX, y: t.clientY };
        e.preventDefault();
      }

      function onTouchMove(e) {
        if (!placed || touchId === null) return;
        let touch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touch = e.changedTouches[i];
            break;
          }
        }
        if (!touch) return;

        const dx = touch.clientX - lastTouch.x;
        const dy = touch.clientY - lastTouch.y;
        lastTouch = { x: touch.clientX, y: touch.clientY };

        theta += dx * data.orbitSpeed;
        phi   -= dy * data.orbitSpeed;
        phi    = Math.max(data.minPolar, Math.min(data.maxPolar, phi));

        applyOrbitCamera();
        e.preventDefault();
      }

      function onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId   = null;
            lastTouch = null;
            break;
          }
        }
      }

      // Mouse fallback (desktop preview)
      let mouseDown = false;
      let lastMouse = null;

      function onMouseDown(e) {
        if (!placed) return;
        mouseDown = true;
        lastMouse = { x: e.clientX, y: e.clientY };
      }
      function onMouseMove(e) {
        if (!placed || !mouseDown) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        lastMouse = { x: e.clientX, y: e.clientY };
        theta += dx * data.orbitSpeed;
        phi   -= dy * data.orbitSpeed;
        phi    = Math.max(data.minPolar, Math.min(data.maxPolar, phi));
        applyOrbitCamera();
      }
      function onMouseUp() { mouseDown = false; }

      document.addEventListener("touchstart", onTouchStart, { passive: false });
      document.addEventListener("touchmove",  onTouchMove,  { passive: false });
      document.addEventListener("touchend",   onTouchEnd,   { passive: false });
      document.addEventListener("mousedown",  onMouseDown);
      document.addEventListener("mousemove",  onMouseMove);
      document.addEventListener("mouseup",    onMouseUp);

      // ── AR hit-test tap-to-place ──────────────

      function onXrHitTest(e) {
        if (placed) return;
        const { detail } = e;
        if (detail && detail.hits && detail.hits.length > 0) {
          placeChess(detail.hits[0]);
        }
      }

      // 8th Wall fires this on tap when hit-test mode is on
      window.addEventListener("xrhittest", onXrHitTest);

      // ── Expose reset for UI button ────────────
      window.arOrbit = {
        resetPlacement() {
          placed = false;
          hint.classList.remove("hidden");
          resetBtn.style.display = "none";
        }
      };

      // Store refs for cleanup
      component._cleanup = () => {
        document.removeEventListener("touchstart", onTouchStart);
        document.removeEventListener("touchmove",  onTouchMove);
        document.removeEventListener("touchend",   onTouchEnd);
        document.removeEventListener("mousedown",  onMouseDown);
        document.removeEventListener("mousemove",  onMouseMove);
        document.removeEventListener("mouseup",    onMouseUp);
        window.removeEventListener("xrhittest",    onXrHitTest);
      };

      console.log("[orbit-controller] ready — tap a surface to place the chess set.");
    },

    remove(world, component) {
      if (component._cleanup) component._cleanup();
    },
  });

  // ─────────────────────────────────────────────
  // SCENE DEFINITION
  // ─────────────────────────────────────────────
  const sceneData = JSON.parse(`{
    "objects": {
      "47699d9e-18a5-4f88-a4f9-b8be92e8f74a": {
        "components": {},
        "geometry": null,
        "id": "47699d9e-18a5-4f88-a4f9-b8be92e8f74a",
        "light": { "type": "ambient" },
        "material": null,
        "name": "Ambient Light",
        "position": [10, 5, 5],
        "rotation": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "parentId": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "order": 0.4
      },
      "ac1989e3-3b71-49e2-a05f-e682aeb18c36": {
        "components": {},
        "geometry": null,
        "id": "ac1989e3-3b71-49e2-a05f-e682aeb18c36",
        "light": { "intensity": 1, "type": "directional" },
        "material": null,
        "name": "Directional Light",
        "position": [20, 50, 10],
        "rotation": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "parentId": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "order": 0.66
      },
      "a608ddd9-9379-464d-966f-5d8d8674c83c": {
        "camera": {
          "type": "perspective",
          "xr": {
            "desktop": "3D",
            "xrCameraType": "3dOnly",
            "headset": "disabled"
          }
        },
        "components": {},
        "geometry": null,
        "id": "a608ddd9-9379-464d-966f-5d8d8674c83c",
        "material": null,
        "name": "Camera",
        "position": [0, 2, 3],
        "rotation": [0.0004436887233141012, 0.9659425615285845, -0.25875089860082223, 0.0016563336561801576],
        "scale": [1, 1, 1],
        "parentId": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "order": 1.03
      },
      "76ad7e6d-ef32-474d-b327-859fdeeb7af9": {
        "id": "76ad7e6d-ef32-474d-b327-859fdeeb7af9",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0, 1],
        "scale": [0, 0, 0],
        "geometry": null,
        "material": null,
        "parentId": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "components": {},
        "gltfModel": {
          "src": { "type": "asset", "asset": "assets/chess.glb" },
          "animationClip": "",
          "loop": true
        },
        "name": "chess.glb",
        "order": 2.51
      },
      "orbit-root": {
        "id": "orbit-root",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "geometry": null,
        "material": null,
        "parentId": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "components": {
          "orbit-ctrl-comp": {
            "id": "orbit-ctrl-comp",
            "name": "orbit-controller",
            "parameters": {
              "orbitSpeed": 0.005,
              "minPolar": 0.1,
              "maxPolar": 1.35,
              "radius": 3.0,
              "targetName": "chess.glb"
            }
          }
        },
        "name": "OrbitRoot",
        "order": 3.0
      }
    },
    "spaces": {
      "88453035-dc0f-486d-868a-8ff7c2fda864": {
        "id": "88453035-dc0f-486d-868a-8ff7c2fda864",
        "name": "Default Space",
        "activeCamera": "a608ddd9-9379-464d-966f-5d8d8674c83c"
      }
    },
    "entrySpaceId": "88453035-dc0f-486d-868a-8ff7c2fda864"
  }`);

  delete sceneData.history;
  delete sceneData.historyVersion;
  window.ecs.application.init(sceneData);
})();