import StreamZip from "node-stream-zip"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dirname, join } from "path/posix"
import sharp from "sharp"
import { asyncConcurrency } from "../comTypes/util"
import { BlockStateDefinition, ModelDefinition } from "./minecraft/assets"
import { Stopwatch } from "./support/Stopwatch"
import { print } from "./support/log"
import { TextureResource } from "./textures/TextureResource"

export function normaliseResourceId(id: string) {
    if (!id.includes(":")) return "minecraft:" + id
    return id
}

export class ResourceProvider {
    public async importSource(path: string) {
        const zip = new StreamZip.async({ file: path })

        const existingPaths = new Set<string>()
        const queue = asyncConcurrency<any>(100)

        for (const entry of Object.values(await zip.entries())) {
            if (!entry.isDirectory && entry.name.match(/^assets\/\w+\/(textures\/block|blockstates|models\/block)\//)) {
                const targetPath = join(this.path, entry.name)
                const targetDirname = dirname(targetPath)

                if (!existingPaths.has(targetDirname)) {
                    await mkdir(targetDirname, { recursive: true })
                    print(`Extracting: ${targetDirname}`)
                    existingPaths.add(targetDirname)
                }

                queue.push(() => zip.extract(entry.name, targetPath))
            }
        }

        await queue.join()
        await zip.close()
    }

    protected readonly _blockStateCache = new Map<string, BlockStateDefinition | null>()

    public async loadBlockStateDefinition(id: string) {
        if (this._blockStateCache.has(id)) return this._blockStateCache.get(id)

        const [namespace, path] = id.split(":")
        let content
        try {
            content = await readFile(join(this.path, "assets", namespace, "blockstates", path + ".json"), "utf-8")
        } catch (err: any) {
            if (err.code == "ENOENT") {
                this._blockStateCache.set(id, null)
                return null
            }

            throw err
        }

        const definition = JSON.parse(content) as BlockStateDefinition
        this._blockStateCache.set(id, definition)
        return definition
    }

    protected readonly _modelCache = new Map<string, ModelDefinition | null>()

    public async loadModelDefinition(id: string) {
        if (this._modelCache.has(id)) return this._modelCache.get(id)

        const [namespace, path] = id.split(":")
        let content
        try {
            content = await readFile(join(this.path, "assets", namespace, "models", path + ".json"), "utf-8")
        } catch (err: any) {
            if (err.code == "ENOENT") {
                this._modelCache.set(id, null)
                return null
            }

            throw err
        }

        const definition = JSON.parse(content) as ModelDefinition
        this._modelCache.set(id, definition)
        return definition
    }

    protected readonly _textureCache = new Map<string, TextureResource | null>()

    public async loadTexture(id: string) {
        if (this._textureCache.has(id)) return this._textureCache.get(id)

        const [namespace, path] = id.split(":")
        let image
        let metadata
        try {
            const fullPath = join(this.path, "assets", namespace, "textures", path + ".png")
            image = sharp(fullPath)
            metadata = await image.metadata()
        } catch (err: any) {
            if (err.code == "ENOENT") {
                this._textureCache.set(id, null)
                return null
            }

            throw err
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

        const definition = new TextureResource(metadata.width, metadata.height, transparency, image)
        this._textureCache.set(id, definition)
        return definition
    }

    constructor(
        public readonly path: string,
    ) { }

    public static async createOrOpen(path: string | null | undefined) {
        path ??= resolve("cache")
        await mkdir(path, { recursive: true })
        return new ResourceProvider(path)
    }
}
