import { Assets, Spritesheet, Texture, type SpritesheetData } from 'pixi.js'
import { GAME_ATLASES } from '@/game/assets'

class PixiAssetLibrary {
  private sheets = new Map<string, Spritesheet>()
  private pending: Promise<void> | null = null

  preload(): Promise<void> {
    if (this.pending) return this.pending
    this.pending = Promise.all(
      GAME_ATLASES.map(async (definition) => {
        const source = await Assets.load<Texture>(definition.imageUrl)
        source.source.scaleMode = 'nearest'
        const data = {
          ...definition.data,
          meta: { ...definition.data.meta, scale: '1' }
        } as unknown as SpritesheetData
        const sheet = new Spritesheet(source, data)
        await sheet.parse()
        for (const texture of Object.values(sheet.textures)) texture.source.scaleMode = 'nearest'
        this.sheets.set(definition.id, sheet)
      })
    ).then(() => undefined)
    return this.pending
  }

  texture(atlasId: string, frameName: string): Texture {
    return this.sheets.get(atlasId)?.textures[frameName] || Texture.EMPTY
  }

  has(atlasId: string, frameName: string): boolean {
    return !!this.sheets.get(atlasId)?.textures[frameName]
  }
}

export const pixiAssets = new PixiAssetLibrary()
