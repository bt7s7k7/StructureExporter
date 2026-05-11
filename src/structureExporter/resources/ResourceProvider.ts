import { join } from "node:path"
import sharp from "sharp"
import { BlockStateDefinition, ModelDefinition, TextureAnimationDefinition } from "../minecraft/assets"
import { Stopwatch } from "../support/Stopwatch"
import { TextureResource } from "../textures/TextureResource"
import { ResourcePackManager } from "./ResourcePackManager"

export function normaliseResourceId(id: string) {
    if (!id.includes(":")) return "minecraft:" + id
    return id
}

export class ResourceProvider {
    protected readonly _blockStateCache = new Map<string, BlockStateDefinition | null>()

    public async loadBlockStateDefinition(id: string) {
        if (this._blockStateCache.has(id)) return this._blockStateCache.get(id)

        const [namespace, path] = id.split(":")
        const content = await this.resourcePacks.loadResource(join("assets", namespace, "blockstates", path + ".json"))
        if (content == null) {
            this._blockStateCache.set(id, null)
            return null
        }

        const definition = JSON.parse(content.toString("utf-8")) as BlockStateDefinition
        this._blockStateCache.set(id, definition)
        return definition
    }

    protected readonly _modelCache = new Map<string, ModelDefinition | null>()

    public async loadModelDefinition(id: string) {
        if (this._modelCache.has(id)) return this._modelCache.get(id)

        const [namespace, path] = id.split(":")
        const content = await this.resourcePacks.loadResource(join("assets", namespace, "models", path + ".json"))
        if (content == null) {
            this._modelCache.set(id, null)
            return null
        }

        const definition = JSON.parse(content.toString("utf-8")) as ModelDefinition
        this._modelCache.set(id, definition)
        return definition
    }

    protected readonly _textureCache = new Map<string, TextureResource | null>()

    public async loadTexture(id: string) {
        if (this._textureCache.has(id)) return this._textureCache.get(id)

        const [namespace, path] = id.split(":")
        const fullPath = join("assets", namespace, "textures", path + ".png")
        const content = await this.resourcePacks.loadResource(fullPath)
        if (content == null) {
            this._textureCache.set(id, null)
            return null
        }

        let image = sharp(content)
        let { width, height } = await image.metadata()

        // Check for animated textures to only cut out the first frame
        const metadataFile = await this.resourcePacks.loadResource(fullPath + ".mcmeta")
        if (metadataFile != null) {
            const metadata: TextureAnimationDefinition = JSON.parse(metadataFile.toString("utf-8"));

            [width, height] = [
                metadata.animation.width ?? (metadata.animation.height != null ? width : Math.min(width, height)),
                metadata.animation.height ?? (metadata.animation.width != null ? height : Math.min(width, height)),
            ]

            image = image.extract({
                top: 0, left: 0,
                width, height,
            })
        }

        let transparency: TextureResource["transparency"] = "opaque"
        const stopwatch = new Stopwatch()

        stopwatch.start("imageAnalysis/load")

        const data = await image
            .ensureAlpha()
            .raw()
            .toBuffer()

        stopwatch.start("imageAnalysis/work")

        for (let i = 3 /* Start at 3, which is the alpha channel */; i < data.length; i += 4) {
            const alpha = data[i]
            if (alpha == 0) {
                if (transparency == "opaque") transparency = "scissor"
            } else if (alpha < 255) {
                transparency = "transparent"
            }
        }

        stopwatch.end()

        const definition = new TextureResource(width, height, transparency, image)
        this._textureCache.set(id, definition)
        return definition
    }

    constructor(
        public readonly resourcePacks: ResourcePackManager,
    ) { }
}
