import StreamZip from "node-stream-zip"
import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { dirname, join } from "path/posix"
import { asyncConcurrency } from "../comTypes/util"
import { print } from "./log"
import { BlockStateDefinition, ModelDefinition } from "./minecraft/assets"

export function normaliseResourceId(id: string) {
    if (!id.includes(":")) return "minecraft:" + id
    return id
}

export class SourceManager {
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


    constructor(
        public readonly path: string,
    ) { }

    public static async createOrOpen(path: string | null | undefined) {
        path ??= resolve("cache")
        await mkdir(path, { recursive: true })
        return new SourceManager(path)
    }
}
