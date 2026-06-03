import { mat4, vec3 } from 'gl-matrix'
import { NbtFile, Structure, ThreeStructureRenderer, loadDefaultPackResources } from '@mattzh72/lodestone'
import './style.css'

class OrbitCamera {
  constructor(canvas, center, distance) {
    this.canvas = canvas
    this.center = center
    this.distance = distance
    this.xRotation = 0.62
    this.yRotation = 0.82
    this.dragging = false
    this.lastPos = null

    canvas.addEventListener('pointerdown', event => {
      this.dragging = true
      this.lastPos = [event.clientX, event.clientY]
      canvas.setPointerCapture(event.pointerId)
    })
    canvas.addEventListener('pointerup', event => {
      this.dragging = false
      this.lastPos = null
      canvas.releasePointerCapture(event.pointerId)
    })
    canvas.addEventListener('pointermove', event => {
      if (!this.dragging || !this.lastPos) return
      this.yRotation += (event.clientX - this.lastPos[0]) / 160
      this.xRotation += (event.clientY - this.lastPos[1]) / 160
      this.xRotation = Math.max(-1.05, Math.min(1.35, this.xRotation))
      this.lastPos = [event.clientX, event.clientY]
    })
    canvas.addEventListener('wheel', event => {
      event.preventDefault()
      this.distance = Math.max(4, Math.min(500, this.distance + event.deltaY * 0.08))
    }, { passive: false })
  }

  getView() {
    const view = mat4.create()
    mat4.translate(view, view, [0, 0, -this.distance])
    mat4.rotateX(view, view, this.xRotation)
    mat4.rotateY(view, view, this.yRotation)
    mat4.translate(view, view, [-this.center[0], -this.center[1], -this.center[2]])
    return view
  }

  getCamera() {
    const inverse = mat4.create()
    mat4.invert(inverse, this.getView())
    return {
      position: vec3.fromValues(inverse[12], inverse[13], inverse[14]),
      target: this.center,
    }
  }
}

function getParam(name, fallback) {
  const params = new URLSearchParams(window.location.search)
  return params.get(name) ?? fallback
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

function resize(renderer, canvas) {
  const rect = canvas.getBoundingClientRect()
  renderer.setViewport(0, 0, rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
}

async function main() {
  const canvas = document.getElementById('preview')
  const loading = document.getElementById('loading')
  const nameEl = document.getElementById('build-name')
  const statsEl = document.getElementById('build-stats')

  nameEl.textContent = getParam('name', 'Minecraft Build')

  const [structure, pack] = await Promise.all([
    loadStructure(),
    loadDefaultPackResources({ baseUrl: new URL('/__minecraft_builder__/default-pack/', window.location.href).toString() }),
  ])
  const size = structure.getSize()
  const blockCount = structure.getBlocks().length
  statsEl.textContent = `${size[0]} x ${size[1]} x ${size[2]} | ${blockCount.toLocaleString()} blocks`

  const renderer = new ThreeStructureRenderer(canvas, structure, pack.resources, {
    chunkSize: 16,
    drawDistance: 1000,
    useInvisibleBlockBuffer: false,
    asyncBuild: true,
    asyncChunkBuildTimeMs: 8,
    sunlight: {
      direction: vec3.fromValues(0.35, 0.85, 0.25),
      intensity: 1.15,
      ambientIntensity: 0.62,
      fillIntensity: 0.32,
      rimIntensity: 0.35,
      exposure: 1.08,
      sky: {
        zenithColor: [0.24, 0.48, 0.84],
        horizonColor: [0.78, 0.9, 1.0],
        groundColor: [0.18, 0.2, 0.22],
      },
      fog: {
        color: [0.78, 0.86, 0.94],
        density: 0.00012,
        heightFalloff: 0.001,
      },
    },
  })

  const center = vec3.fromValues(size[0] / 2, Math.max(1, size[1] / 2.5), size[2] / 2)
  const camera = new OrbitCamera(canvas, center, Math.max(18, Math.max(...size) * 1.9))
  resize(renderer, canvas)
  await renderer.whenReady()
  loading.classList.add('hidden')

  const resizeObserver = new ResizeObserver(() => resize(renderer, canvas))
  resizeObserver.observe(canvas)

  function frame() {
    const state = camera.getCamera()
    renderer.lookAt(state.position, state.target)
    renderer.drawStructure()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

main().catch(error => {
  console.error(error)
  document.getElementById('loading').textContent = error.message
})
