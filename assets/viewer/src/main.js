import { mat4, vec3 } from 'gl-matrix'
import { NbtFile, Structure, ThreeStructureRenderer, loadDefaultPackResources } from '@mattzh72/lodestone'
import './style.css'

const originalWarn = console.warn.bind(console)
console.warn = (...args) => {
  if (args.length === 1 && args[0] === 'parent minecraft:builtin/entity does not exist!') return
  originalWarn(...args)
}

// Daylight is tuned to be colour-neutral (white sun, grey-blue sky fill) so block colours in
// renders match their in-game textures; the Lodestone defaults tint everything orange/purple.
const LIGHTING_PRESETS = {
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
    sky: {
      zenithColor: [0.24, 0.48, 0.84],
      horizonColor: [0.78, 0.9, 1.0],
      groundColor: [0.18, 0.2, 0.22],
      stars: {
        enabled: false,
      },
    },
    fog: {
      color: [0.78, 0.86, 0.94],
      density: 0.00012,
      heightFalloff: 0.001,
    },
    // Daylight: light sources barely tint their surroundings (they do not light up a sunny scene).
    emissive: {
      range: 8,
      intensity: 0.35,
      tint: [1.0, 0.9, 0.75],
    },
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
      stars: {
        enabled: true,
        density: 0.72,
        brightness: 0.92,
      },
    },
    disc: {
      size: 42,
      coreColor: [0.72, 0.78, 1.0],
      glowColor: [0.34, 0.45, 0.92],
      coreIntensity: 0.42,
      glowIntensity: 0.16,
      softness: 0.4,
    },
    fog: {
      color: [0.035, 0.05, 0.1],
      density: 0.00008,
      heightFalloff: 0.00065,
    },
    shadow: {
      enabled: true,
      intensity: 0.2,
      softness: 0.82,
    },
    emissive: {
      range: 18,
      intensity: 1.35,
      tint: [1.0, 0.88, 0.68],
    },
  },
}

// Named camera presets. yaw is the compass direction the camera sits at, measured from
// south (+z) toward east (+x): 0 = south, 90 = east, 180 = north, 270 = west.
// pitch is degrees above the horizon. Elevation views use a narrow fov to flatten perspective.
const VIEW_PRESETS = {
  se: { yaw: 45, pitch: 30, fov: 40 },
  sw: { yaw: 315, pitch: 30, fov: 40 },
  ne: { yaw: 135, pitch: 30, fov: 40 },
  nw: { yaw: 225, pitch: 30, fov: 40 },
  south: { yaw: 0, pitch: 4, fov: 20 },
  north: { yaw: 180, pitch: 4, fov: 20 },
  east: { yaw: 90, pitch: 4, fov: 20 },
  west: { yaw: 270, pitch: 4, fov: 20 },
  top: { yaw: 0, pitch: 89.5, fov: 30 },
  hero: { yaw: 30, pitch: 12, fov: 50 },
  low: { yaw: 210, pitch: 6, fov: 55 },
}

const DEG = Math.PI / 180

// Interactive camera orbiting a center point. Angles follow the same yaw/pitch convention.
class OrbitCamera {
  constructor(canvas, center, distance, onChange = () => undefined) {
    this.canvas = canvas
    this.center = center
    this.distance = distance
    this.pitch = 35 * DEG
    this.yaw = 47 * DEG
    this.dragging = false
    this.lastPos = null
    this.onChange = onChange

    canvas.addEventListener('pointerdown', event => {
      this.dragging = true
      this.lastPos = [event.clientX, event.clientY]
      canvas.setPointerCapture?.(event.pointerId)
    })
    const stopDragging = event => {
      this.dragging = false
      this.lastPos = null
      if (event?.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
    }
    canvas.addEventListener('pointerup', stopDragging)
    canvas.addEventListener('pointercancel', stopDragging)
    canvas.addEventListener('lostpointercapture', stopDragging)
    canvas.addEventListener('pointermove', event => {
      if (!this.dragging || !this.lastPos) return
      this.yaw -= (event.clientX - this.lastPos[0]) / 160
      this.pitch += (event.clientY - this.lastPos[1]) / 160
      this.pitch = Math.max(-1.05, Math.min(1.55, this.pitch))
      this.lastPos = [event.clientX, event.clientY]
      this.onChange()
    })
    canvas.addEventListener('wheel', event => {
      event.preventDefault()
      const distance = Math.max(4, Math.min(1500, this.distance + event.deltaY * 0.08))
      if (distance !== this.distance) {
        this.distance = distance
        this.onChange()
      }
    }, { passive: false })
  }

  getCamera() {
    return {
      position: orbitPosition(this.center, this.yaw, this.pitch, this.distance),
      target: this.center,
    }
  }
}

function orbitPosition(center, yaw, pitch, distance) {
  return vec3.fromValues(
    center[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
    center[1] + Math.sin(pitch) * distance,
    center[2] + Math.cos(yaw) * Math.cos(pitch) * distance,
  )
}

function getParam(name, fallback) {
  const params = new URLSearchParams(window.location.search)
  return params.get(name) ?? fallback
}

function getNumberList(name, length) {
  const raw = getParam(name, undefined)
  if (!raw) return undefined
  const values = raw.split(',').map(Number)
  if (values.length !== length || !values.every(Number.isFinite)) return undefined
  return values
}

function getLightingMode() {
  const value = getParam('lighting', 'day').toLowerCase()
  return value === 'night' ? 'night' : 'day'
}

function setLightingUrl(mode) {
  const url = new URL(window.location.href)
  if (mode === 'day') {
    url.searchParams.delete('lighting')
  } else {
    url.searchParams.set('lighting', mode)
  }
  window.history.replaceState({}, '', url)
}

function updateLightingButton(button, mode) {
  button.textContent = mode === 'night' ? 'Day' : 'Night'
  button.title = mode === 'night' ? 'Switch to day lighting' : 'Switch to night lighting'
  button.setAttribute('aria-pressed', String(mode === 'night'))
}

async function loadStructure() {
  const nbtUrl = getParam('nbt', '/__minecraft_builder__/build.nbt')
  const response = await fetch(nbtUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch NBT: ${response.status} ${response.statusText}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  return Structure.fromNbt(NbtFile.read(bytes).root)
}

// Keeps only blocks inside an inclusive [x0,y0,z0,x1,y1,z1] box (used for cutaway renders).
function clipStructure(structure, clip) {
  const [x0, y0, z0, x1, y1, z1] = clip
  const clipped = new Structure(structure.getSize())
  for (const block of structure.getBlocks()) {
    const [x, y, z] = block.pos
    if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) continue
    clipped.addBlock(block.pos, block.state.getName(), block.state.getProperties(), block.nbt)
  }
  return clipped
}

function computeBounds(structure) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const block of structure.getBlocks()) {
    if (block.state.isAir?.() || block.state.getName().toString().endsWith(':air')) continue
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], block.pos[i])
      max[i] = Math.max(max[i], block.pos[i] + 1)
    }
  }
  if (!Number.isFinite(min[0])) {
    const size = structure.getSize()
    return { min: [0, 0, 0], max: [...size] }
  }
  return { min, max }
}

// Distance at which every corner of the bounds fits in the frustum for this view direction.
function fitDistance(bounds, center, yaw, pitch, fovDeg, aspect, margin = 1.06) {
  const forward = vec3.fromValues(
    -Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  )
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
        const r = Math.abs(vec3.dot(rel, right))
        const u = Math.abs(vec3.dot(rel, up))
        distance = Math.max(distance, (r * margin) / tanH - along, (u * margin) / tanV - along)
      }
  return distance
}

function shadowSettingsFor(bounds, preset) {
  const extent = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2])
  return {
    ...preset,
    shadow: {
      ...(preset.shadow ?? {}),
      frustumSize: Math.max(32, Math.ceil(extent * 1.15)),
      mapSize: 4096,
    },
  }
}

function resize(renderer, canvas) {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  renderer.setViewport(0, 0, rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
  return true
}

async function main() {
  const canvas = document.getElementById('preview')
  const loading = document.getElementById('loading')
  const nameEl = document.getElementById('build-name')
  const statsEl = document.getElementById('build-stats')
  const lightingToggle = document.getElementById('lighting-toggle')
  const capture = getParam('capture', '0') === '1'
  let lightingMode = getLightingMode()

  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #preview canvas')
  if (!loading || !nameEl || !statsEl || !(lightingToggle instanceof HTMLButtonElement)) {
    throw new Error('Missing viewer controls')
  }
  if (capture) document.body.classList.add('capture')

  nameEl.textContent = getParam('name', 'Minecraft Build')
  updateLightingButton(lightingToggle, lightingMode)

  const [loadedStructure, pack] = await Promise.all([
    loadStructure(),
    loadDefaultPackResources({ baseUrl: new URL('/__minecraft_builder__/default-pack/', window.location.href).toString() }),
  ])
  const clip = getNumberList('clip', 6)
  const clipY = getParam('clipY', undefined)
  const size = loadedStructure.getSize()
  const clipBox = clip ?? (clipY !== undefined && Number.isFinite(Number(clipY))
    ? [0, 0, 0, size[0] - 1, Number(clipY), size[2] - 1]
    : undefined)
  const structure = clipBox ? clipStructure(loadedStructure, clipBox) : loadedStructure
  const blockCount = structure.getBlocks().length
  const bounds = computeBounds(structure)
  statsEl.textContent = `${size[0]} x ${size[1]} x ${size[2]} | ${blockCount.toLocaleString()} blocks`

  const lightingFor = mode => shadowSettingsFor(bounds, LIGHTING_PRESETS[mode])
  const renderer = new ThreeStructureRenderer(canvas, structure, pack.resources, {
    chunkSize: 16,
    drawDistance: 4000,
    useInvisibleBlockBuffer: false,
    asyncBuild: true,
    asyncChunkBuildTimeMs: capture ? 200 : 8,
    preserveDrawingBuffer: capture,
    sunlight: lightingFor(lightingMode),
  })

  const boundsCenter = vec3.fromValues(
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  )
  const initialFov = Number(getParam('fov', '45'))
  renderer.setFOV(initialFov)
  let frameRequest = 0
  const camera = new OrbitCamera(canvas, boundsCenter, 10, requestRender)
  camera.yaw = Number(getParam('yaw', '47')) * DEG
  camera.pitch = Number(getParam('pitch', '35')) * DEG
  const target = getNumberList('target', 3)
  if (target) camera.center = vec3.fromValues(...target)
  const rect = canvas.getBoundingClientRect()
  const aspect = rect.width / Math.max(1, rect.height)
  camera.distance = Number(getParam('distance', '0')) ||
    fitDistance(bounds, camera.center, camera.yaw, camera.pitch, initialFov, aspect) / Number(getParam('zoom', '1'))

  function render() {
    frameRequest = 0
    const state = camera.getCamera()
    renderer.lookAt(state.position, state.target)
    renderer.drawStructure()
  }

  function requestRender() {
    if (frameRequest) return
    frameRequest = requestAnimationFrame(render)
  }

  lightingToggle.addEventListener('click', () => {
    lightingMode = lightingMode === 'night' ? 'day' : 'night'
    renderer.setSunlight(lightingFor(lightingMode))
    updateLightingButton(lightingToggle, lightingMode)
    setLightingUrl(lightingMode)
    requestRender()
  })

  resize(renderer, canvas)
  await renderer.whenReady()
  render()
  loading.classList.add('hidden')

  const resizeObserver = new ResizeObserver(() => {
    if (resize(renderer, canvas)) requestRender()
  })
  resizeObserver.observe(canvas)

  // Programmatic API used by scripts/render.mjs for headless screenshots.
  window.__mcbViewer = {
    size,
    bounds,
    blockCount,
    presets: VIEW_PRESETS,
    setLighting(mode) {
      lightingMode = mode === 'night' ? 'night' : 'day'
      renderer.setSunlight(lightingFor(lightingMode))
    },
    // view: preset name or { yaw, pitch, fov, zoom, distance, target: [x,y,z] }
    renderView(view, width, height) {
      const spec = typeof view === 'string' ? { ...VIEW_PRESETS[view] } : { ...view }
      if (!spec || spec.yaw === undefined) throw new Error(`Unknown view: ${JSON.stringify(view)}`)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      renderer.setViewport(0, 0, width, height, 1)
      const fov = spec.fov ?? 45
      renderer.setFOV(fov)
      const yaw = spec.yaw * DEG
      const pitch = spec.pitch * DEG
      const center = spec.target ? vec3.fromValues(...spec.target) : boundsCenter
      const distance = spec.distance ??
        fitDistance(bounds, center, yaw, pitch, fov, width / height) / (spec.zoom ?? 1)
      renderer.lookAt(orbitPosition(center, yaw, pitch, distance), center)
      renderer.drawStructure()
      return canvas.toDataURL('image/png')
    },
  }
}

main().catch(error => {
  console.error(error)
  window.__mcbViewerError = String(error?.stack ?? error)
  document.getElementById('loading').textContent = error.message
})
