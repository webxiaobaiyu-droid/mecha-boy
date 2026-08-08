export interface AtlasFrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasFrame {
  frame: AtlasFrameRect
  rotated: boolean
  trimmed: boolean
  spriteSourceSize: AtlasFrameRect
  sourceSize: { w: number; h: number }
  duration: number
}

export interface AtlasJson {
  frames: Record<string, AtlasFrame>
  meta: {
    image: string
    size: { w: number; h: number }
    frameTags?: { name: string; from: number; to: number; direction: string }[]
  }
}

export interface AtlasDefinition {
  id: string
  imageUrl: string
  data: AtlasJson
}

interface LoadedAtlas extends AtlasDefinition {
  image: HTMLImageElement
}

export interface DrawFrameOptions {
  scale?: number
  anchor?: [number, number]
  flipX?: boolean
  alpha?: number
  filter?: string
}

class AtlasRegistry {
  private atlases = new Map<string, LoadedAtlas>()
  private pending: Promise<void> | null = null

  preload(definitions: AtlasDefinition[]): Promise<void> {
    if (this.pending) return this.pending
    this.pending = Promise.all(definitions.map((def) => this.load(def))).then(() => undefined)
    return this.pending
  }

  private async load(definition: AtlasDefinition) {
    const image = new Image()
    image.decoding = 'async'
    image.src = definition.imageUrl
    await image.decode()
    const expected = definition.data.meta.size
    if (image.naturalWidth !== expected.w || image.naturalHeight !== expected.h) {
      throw new Error(`Atlas ${definition.id} size mismatch`)
    }
    for (const [name, frame] of Object.entries(definition.data.frames)) {
      if (frame.rotated) throw new Error(`Atlas ${definition.id} contains rotated frame ${name}`)
    }
    this.atlases.set(definition.id, { ...definition, image })
  }

  ready(atlasId: string) {
    return this.atlases.has(atlasId)
  }

  hasFrame(atlasId: string, frameName: string) {
    return !!this.atlases.get(atlasId)?.data.frames[frameName]
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    atlasId: string,
    frameName: string,
    x: number,
    y: number,
    options: DrawFrameOptions = {}
  ): boolean {
    const atlas = this.atlases.get(atlasId)
    const frame = atlas?.data.frames[frameName]
    if (!atlas || !frame) return false
    const scale = options.scale ?? 1
    const anchor = options.anchor ?? [0, 0]
    const source = frame.frame
    const sourcePos = frame.spriteSourceSize
    const targetX = Math.round(x - anchor[0] * scale + sourcePos.x * scale)
    const targetY = Math.round(y - anchor[1] * scale + sourcePos.y * scale)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha
    if (options.filter) ctx.filter = options.filter
    if (options.flipX) {
      ctx.translate(targetX + source.w * scale, targetY)
      ctx.scale(-1, 1)
      ctx.drawImage(
        atlas.image,
        source.x,
        source.y,
        source.w,
        source.h,
        0,
        0,
        source.w * scale,
        source.h * scale
      )
    } else {
      ctx.drawImage(
        atlas.image,
        source.x,
        source.y,
        source.w,
        source.h,
        targetX,
        targetY,
        source.w * scale,
        source.h * scale
      )
    }
    ctx.restore()
    return true
  }
}

export const atlasRegistry = new AtlasRegistry()
