// The 3D preview: Lodestone's three.js renderer with the plugin viewer's lighting
// (assets/viewer/src/main.js), an orbit camera for the overview and a first-person camera for the
// spawn point and free flight. Renders on demand; keeps drawing while chunks are still meshing.

import { vec3 } from 'gl-matrix'
import { ThreeStructureRenderer } from '../../../scripts/node_modules/lodestone/lib/index.js'

const DEG = Math.PI / 180

// the viewer's presets: a colour-neutral day and a moonlit night where lamps glow
export const LIGHTING = {
  day: {
    direction: vec3.fromValues(0.35, 0.85, 0.25),
    color: [1.0, 0.98, 0.94],
    ambientColor: [0.86, 0.9, 1.0],
    fillColor: [0.66, 0.68, 0.74],
    rimColor: [1.0, 1.0, 1.0],
    intensity: 0.78,
    ambientIntensity: 0.56,
    fillIntensity: 0.22,
    rimIntensity: 0.06,
    exposure: 1.0,
    // the space under the horizon is the void below the island: a light haze instead of the viewer's dark ground
    sky: { zenithColor: [0.24, 0.48, 0.84], horizonColor: [0.78, 0.9, 1.0], groundColor: [0.5, 0.6, 0.7], stars: { enabled: false } },
    fog: { color: [0.78, 0.86, 0.94], density: 0.00012, heightFalloff: 0.001 },
    emissive: { range: 8, intensity: 0.35, tint: [1.0, 0.9, 0.75] },
  },
  night: {
    direction: vec3.fromValues(-0.32, 0.5, -0.42),
    color: [0.62, 0.72, 1.0],
    ambientColor: [0.34, 0.43, 0.72],
    fillColor: [0.13, 0.18, 0.36],
    rimColor: [0.5, 0.64, 1.0],
    intensity: 0.28,
    ambientIntensity: 0.52,
    fillIntensity: 0.2,
    rimIntensity: 0.42,
    exposure: 0.92,
    sky: {
      zenithColor: [0.015, 0.025, 0.08],
      horizonColor: [0.055, 0.085, 0.18],
      groundColor: [0.018, 0.022, 0.038],
      sunGlowColor: [0.48, 0.6, 1.0],
      sunGlowIntensity: 0.22,
      sunGlowExponent: 20,
      stars: { enabled: true, density: 0.72, brightness: 0.92 },
    },
    disc: { size: 42, coreColor: [0.72, 0.78, 1.0], glowColor: [0.34, 0.45, 0.92], coreIntensity: 0.42, glowIntensity: 0.16, softness: 0.4 },
    fog: { color: [0.035, 0.05, 0.1], density: 0.00008, heightFalloff: 0.00065 },
    shadow: { enabled: true, intensity: 0.2, softness: 0.82 },
    emissive: { range: 18, intensity: 1.35, tint: [1.0, 0.88, 0.68] },
  },
}

function computeBounds(structure) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const block of structure.blocks) {
    const name = structure.palette[block.state].getName().toString()
    if (name.endsWith(':air') || name.endsWith('structure_void')) continue
    for (let i = 0; i < 3; i++) {
      if (block.pos[i] < min[i]) min[i] = block.pos[i]
      if (block.pos[i] + 1 > max[i]) max[i] = block.pos[i] + 1
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [...structure.getSize()] }
  return { min, max }
}

// distance at which every corner of the bounds fits the frustum for this view direction
function fitDistance(bounds, center, yaw, pitch, fovDeg, aspect, margin = 1.04) {
  const forward = vec3.fromValues(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
  const worldUp = Math.abs(forward[1]) > 0.99 ? vec3.fromValues(0, 0, -1) : vec3.fromValues(0, 1, 0)
  const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), forward, worldUp))
  const up = vec3.cross(vec3.create(), right, forward)
  const tanV = Math.tan((fovDeg * DEG) / 2)
  const tanH = tanV * aspect
  let distance = 1
  for (const cx of [bounds.min[0], bounds.max[0]])
    for (const cy of [bounds.min[1], bounds.max[1]])
      for (const cz of [bounds.min[2], bounds.max[2]]) {
        const rel = vec3.fromValues(cx - center[0], cy - center[1], cz - center[2])
        const along = vec3.dot(rel, forward)
        distance = Math.max(distance, (Math.abs(vec3.dot(rel, right)) * margin) / tanH - along, (Math.abs(vec3.dot(rel, up)) * margin) / tanV - along)
      }
  return distance
}

const orbitPosition = (c, yaw, pitch, d) => vec3.fromValues(c[0] + Math.sin(yaw) * Math.cos(pitch) * d, c[1] + Math.sin(pitch) * d, c[2] + Math.cos(yaw) * Math.cos(pitch) * d)

// Minecraft angles: yaw 0 faces south (+z), 90 west, 180 north, -90 east; pitch > 0 looks down
const lookVector = (yaw, pitch) => vec3.fromValues(-Math.sin(yaw * DEG) * Math.cos(pitch * DEG), -Math.sin(pitch * DEG), Math.cos(yaw * DEG) * Math.cos(pitch * DEG))

export class Preview {
  constructor(canvas, resources, { onModeChange = () => {} } = {}) {
    this.canvas = canvas
    this.resources = resources
    this.onModeChange = onModeChange
    this.renderer = null
    this.structure = null
    this.lighting = 'day'
    this.mode = 'orbit'
    this.orbit = { center: vec3.create(), yaw: 47 * DEG, pitch: 35 * DEG, distance: 100, fov: 45 }
    this.fp = { pos: vec3.create(), yaw: 180, pitch: 5, fov: 70, speed: 10 }
    this.keys = new Set()
    this.frame = 0
    this.building = false
    this.pointers = new Map()
    this.bindInput()
    new ResizeObserver(() => {
      if (this.resize()) this.requestRender()
    }).observe(canvas)
  }

  // ------------------------------------------------------------ structure
  async show(structure, { spawn = null, floorY = null } = {}) {
    this.structure = structure
    this.spawn = spawn
    this.bounds = computeBounds(structure)
    const b = this.bounds
    this.floorY = floorY
    const center = vec3.fromValues((b.min[0] + b.max[0]) / 2, floorY != null ? Math.min(b.max[1], floorY + 4) : (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2)
    this.home = center
    const sunlight = this.sunlight()
    if (!this.renderer) {
      this.renderer = new ThreeStructureRenderer(this.canvas, structure, this.resources, {
        chunkSize: 16,
        drawDistance: 4000,
        useInvisibleBlockBuffer: false,
        asyncBuild: true,
        asyncChunkBuildTimeMs: 12,
        sunlight,
      })
    } else {
      this.renderer.setSunlight(sunlight)
      this.renderer.setStructure(structure)
    }
    this.resize()
    this.setView(this.mode === 'fly' || this.mode === 'spawn' ? this.mode : this.mode === 'top' ? 'top' : 'orbit')
    this.building = true
    const tick = () => {
      if (!this.building) return
      this.draw()
      setTimeout(() => requestAnimationFrame(tick), 120)
    }
    requestAnimationFrame(tick)
    await this.renderer.whenReady()
    this.building = false
    this.requestRender()
  }

  sunlight() {
    const preset = LIGHTING[this.lighting]
    const b = this.bounds ?? { min: [0, 0, 0], max: [64, 64, 64] }
    const extent = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2])
    return { ...preset, shadow: { ...(preset.shadow ?? {}), frustumSize: Math.max(32, Math.ceil(extent * 1.15)), mapSize: 2048 } }
  }

  setLighting(mode) {
    this.lighting = mode === 'night' ? 'night' : 'day'
    if (this.renderer) {
      this.renderer.setSunlight(this.sunlight())
      this.requestRender()
    }
  }

  // ------------------------------------------------------------ cameras
  setView(view) {
    if (!this.structure) {
      this.mode = view
      return
    }
    const rect = this.canvas.getBoundingClientRect()
    const aspect = rect.width / Math.max(1, rect.height)
    if (view === 'orbit' || view === 'top') {
      const o = this.orbit
      o.center = vec3.clone(this.home)
      o.yaw = (view === 'top' ? 0.001 : 47) * DEG
      o.pitch = (view === 'top' ? 89.5 : 33) * DEG
      o.fov = view === 'top' ? 40 : 45
      o.distance = fitDistance(this.bounds, o.center, o.yaw, o.pitch, o.fov, aspect) * (view === 'top' ? 0.96 : 0.8)
    } else if (view === 'spawn') {
      const s = this.spawn
      if (s) {
        // the record's pos is the block the feet stand in; the eye is 1.62 above the feet
        this.fp.pos = vec3.fromValues(s.pos[0] + 0.5, s.pos[1] + 1.62, s.pos[2] + 0.5)
        this.fp.yaw = s.yaw ?? 180
        this.fp.pitch = 4
      } else {
        this.fp.pos = vec3.fromValues(this.home[0], this.home[1] + 2, this.home[2])
      }
      this.fp.fov = 70
    } else if (view === 'fly') {
      if (this.mode === 'orbit' || this.mode === 'top') {
        // start where the orbit camera is, looking at its centre
        const o = this.orbit
        const p = orbitPosition(o.center, o.yaw, o.pitch, o.distance)
        const d = vec3.sub(vec3.create(), o.center, p)
        vec3.normalize(d, d)
        this.fp.pos = p
        this.fp.yaw = Math.atan2(-d[0], d[2]) / DEG
        this.fp.pitch = -Math.asin(d[1]) / DEG
        this.fp.speed = Math.max(10, Math.round(o.distance / 12))
      }
      this.fp.fov = 70
    }
    this.mode = view
    this.onModeChange(view)
    this.requestRender()
  }

  firstPerson() {
    return this.mode === 'spawn' || this.mode === 'fly'
  }

  camera() {
    if (this.firstPerson()) {
      const target = vec3.add(vec3.create(), this.fp.pos, lookVector(this.fp.yaw, this.fp.pitch))
      return { position: this.fp.pos, target, fov: this.fp.fov }
    }
    const o = this.orbit
    return { position: orbitPosition(o.center, o.yaw, o.pitch, o.distance), target: o.center, fov: o.fov }
  }

  // ------------------------------------------------------------ drawing
  resize() {
    if (!this.renderer) return false
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    this.renderer.setViewport(0, 0, rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 1.5))
    return true
  }

  draw() {
    this.frame = 0
    if (!this.renderer) return
    const cam = this.camera()
    this.renderer.setFOV(cam.fov)
    this.renderer.lookAt(cam.position, cam.target)
    this.renderer.drawStructure()
    this.releaseGl()
  }

  // Lodestone meshes chunks with raw WebGL between frames. three.js leaves its last vertex array
  // bound after a draw, so those calls would rebind that object's index buffer (the sky then
  // draws with a chunk's indices and loses a triangle). Unbind after every frame.
  releaseGl() {
    this.renderer.renderer?.resetState?.()
  }

  requestRender() {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => this.draw())
  }

  // a PNG of the current view at a fixed size (the drawing buffer is read in the same task)
  async screenshot(width = 1920, height = 1080) {
    if (!this.renderer) return null
    this.renderer.setViewport(0, 0, width, height, 1)
    const cam = this.camera()
    this.renderer.setFOV(cam.fov)
    this.renderer.lookAt(cam.position, cam.target)
    this.renderer.drawStructure()
    this.releaseGl()
    const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'))
    this.resize()
    this.requestRender()
    return blob
  }

  // ------------------------------------------------------------ input
  bindInput() {
    const c = this.canvas
    c.addEventListener('contextmenu', e => e.preventDefault())
    c.addEventListener('pointerdown', e => {
      c.focus({ preventScroll: true })
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey })
      c.setPointerCapture?.(e.pointerId)
      if (this.pointers.size === 2) this.pinch = this.pinchDistance()
    })
    const end = e => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (this.pointers.size === 2 && this.pinch) {
        const d = this.pinchDistance()
        if (!this.firstPerson() && d > 0) this.zoom(this.pinch / d)
        this.pinch = d
        return
      }
      if (this.firstPerson()) {
        this.fp.yaw += dx * 0.25
        this.fp.pitch = Math.max(-89, Math.min(89, this.fp.pitch + dy * 0.25))
      } else if (p.button === 2 || p.shift) {
        this.pan(dx, dy)
      } else {
        const o = this.orbit
        o.yaw -= dx / 180
        o.pitch = Math.max(-0.2, Math.min(89.5 * DEG, o.pitch + dy / 180))
        if (this.mode === 'top' && Math.abs(dy) + Math.abs(dx) > 2) this.leaveTop()
      }
      this.requestRender()
    })
    c.addEventListener('wheel', e => {
      e.preventDefault()
      if (this.firstPerson()) {
        this.fp.speed = Math.max(2, Math.min(120, this.fp.speed * (e.deltaY > 0 ? 0.85 : 1.18)))
        this.onSpeed?.(this.fp.speed)
      } else {
        this.zoom(Math.exp(e.deltaY * 0.0012))
      }
    }, { passive: false })
    c.addEventListener('keydown', e => {
      if (!this.firstPerson()) return
      const k = e.code
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE', 'ControlLeft'].includes(k)) {
        e.preventDefault()
        if (this.mode === 'spawn') {
          this.mode = 'fly'
          this.onModeChange('fly')
        }
        this.keys.add(k)
        this.startMoving()
      }
    })
    c.addEventListener('keyup', e => this.keys.delete(e.code))
    c.addEventListener('blur', () => this.keys.clear())
  }

  leaveTop() {
    this.mode = 'orbit'
    this.onModeChange('orbit')
  }

  pinchDistance() {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  zoom(factor) {
    this.orbit.distance = Math.max(6, Math.min(3000, this.orbit.distance * factor))
    this.requestRender()
  }

  pan(dx, dy) {
    const o = this.orbit
    const cam = orbitPosition(o.center, o.yaw, o.pitch, o.distance)
    const forward = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), o.center, cam))
    const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), forward, [0, 1, 0]))
    const up = vec3.cross(vec3.create(), right, forward)
    const scale = o.distance * Math.tan((o.fov * DEG) / 2) * 2 / Math.max(1, this.canvas.clientHeight)
    vec3.scaleAndAdd(o.center, o.center, right, -dx * scale)
    vec3.scaleAndAdd(o.center, o.center, up, dy * scale)
  }

  startMoving() {
    if (this.moving) return
    this.moving = true
    let last = performance.now()
    const step = now => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!this.keys.size || !this.firstPerson()) {
        this.moving = false
        return
      }
      const k = this.keys
      const fast = k.has('ControlLeft') ? 3 : 1
      const v = this.fp.speed * fast * dt
      const yaw = this.fp.yaw * DEG
      const fwd = [-Math.sin(yaw), 0, Math.cos(yaw)]
      const right = [-Math.cos(yaw), 0, -Math.sin(yaw)]
      const move = [0, 0, 0]
      const add = (vec, s) => { for (let i = 0; i < 3; i++) move[i] += vec[i] * s }
      if (k.has('KeyW') || k.has('ArrowUp')) add(fwd, 1)
      if (k.has('KeyS') || k.has('ArrowDown')) add(fwd, -1)
      if (k.has('KeyD') || k.has('ArrowRight')) add(right, 1)
      if (k.has('KeyA') || k.has('ArrowLeft')) add(right, -1)
      if (k.has('Space') || k.has('KeyE')) move[1] += 1
      if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyQ')) move[1] -= 1
      const len = Math.hypot(...move) || 1
      for (let i = 0; i < 3; i++) this.fp.pos[i] += (move[i] / len) * v
      this.draw()
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
}
