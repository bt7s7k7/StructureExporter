import { Document, NodeIO, PropertyType } from "@gltf-transform/core"
import { dedup, flatten, join as join_2 } from "@gltf-transform/functions"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { Canvas, Image, ImageData } from "skia-canvas"
import { Cli } from "./cli/Cli"
import { Drawer } from "./drawer/Drawer"
import { Type } from "./struct/Type"
import { BlockBuilder } from "./structureExporter/building/BlockBuilder"
import { Structure } from "./structureExporter/building/Structure"
import { ModelProvider } from "./structureExporter/models/ModelProvider"
import { Platform } from "./structureExporter/Platform"
import { ResourcePackManager } from "./structureExporter/resources/ResourcePackManager"
import { ResourceProvider } from "./structureExporter/resources/ResourceProvider"
import { info } from "./structureExporter/support/log"
import { Stopwatch } from "./structureExporter/support/Stopwatch"
import { TextureAtlas } from "./structureExporter/textures/TextureAtlas"

const _PLATFORM = new class NodePlatform extends Platform {
    public override async mkdir(path: string): Promise<void> {
        await mkdir(path, { recursive: true })
    }

    public override async* readdir(path: string): AsyncGenerator<{ isDirectory(): boolean, name: string }> {
        for (const dirent of await readdir(path, { withFileTypes: true })) {
            yield dirent
        }
    }

    public override async rm(path: string): Promise<void> {
        await rm(path, { force: true, recursive: true })
    }

    public override async read(path: string): Promise<Buffer> {
        return await readFile(path)
    }

    public override async write(path: string, content: Buffer): Promise<void> {
        await writeFile(path, content)
    }

    public override async loadImage(content: Buffer): Promise<Drawer.ImageSource & { width: number, height: number }> {
        return new Image(content) as unknown as HTMLImageElement
    }

    public override async saveImage(image: Drawer): Promise<Uint8Array> {
        const canvas = image.ctx.canvas as any as Canvas
        return await canvas.toBuffer("png")
    }
}

Drawer.CONTEXT_FACTORY = () => new Canvas().getContext("2d") as any
Object.assign(globalThis, { ImageData })

const cli = new Cli("structureExporter")
    .addOption({
        name: "", desc: "Exports a structure as a glTF binary embedded file",
        params: [
            ["input", Type.string],
            ["output", Type.string.as(Type.nullable)],
        ],
        options: {
            resourcePath: Type.string.as(Type.nullable),
            simplify: Type.boolean.as(Type.nullable),
            dryRun: Type.boolean.as(Type.nullable),
            dumpAtlas: Type.boolean.as(Type.nullable),
        },
        async callback(input, output, { resourcePath, simplify, dryRun, dumpAtlas }) {
            const resourcePacks = await ResourcePackManager.createOrOpen(_PLATFORM, resourcePath)
            const resourceProvider = new ResourceProvider(_PLATFORM, resourcePacks)

            if (output == null) {
                output = join(dirname(input), basename(input, extname(input)) + ".glb")
            } else if (output.endsWith("/")) {
                output += basename(input, extname(input)) + ".glb"
            }

            info(`Converting "${input}" -> "${output}"`)
            await _PLATFORM.mkdir(dirname(output))

            const inputData = await readFile(input)
            const structure = await Structure.load(inputData)
            const document = new Document()
            const scene = document.createScene()

            const modelProvider = new ModelProvider(resourceProvider)

            await modelProvider.prepareAssets([...structure.getAssets()])

            const atlas = await TextureAtlas.build(_PLATFORM, document, modelProvider)
            if (dumpAtlas) {
                await writeFile(join(dirname(output), "atlas.png"), atlas.content)
            }

            if (dryRun) return

            const blockBuilder = new BlockBuilder(document, modelProvider, atlas)
            blockBuilder.buildStructure(structure, scene)

            const stopwatch = new Stopwatch().start("simplify")
            if (simplify) {
                await document.transform(
                    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
                    flatten(),
                    join_2(),
                )
            } else {
                await document.transform(
                    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
                )
            }
            stopwatch.end()

            await writeFile(output, await new NodeIO().writeBinary(document))
        },
    })
    .addOption({
        name: "import", desc: "Loads mod or minecraft assets as a resource pack",
        params: [
            ["source", Type.string.as(Type.array)],
        ],
        options: {
            resourcePath: Type.string.as(Type.nullable),
            name: Type.string.as(Type.nullable),
            merge: Type.boolean.as(Type.nullable),
        },
        async callback(source, { resourcePath, name, merge }) {
            const resourcePacks = await ResourcePackManager.createOrOpen(_PLATFORM, resourcePath)
            const method = merge ? "getOrCreatePack" : "createOrOverwritePack"
            const globalPack = name != null ? await resourcePacks[method](name) : null
            for (const path of source) {
                const pack = globalPack ?? await resourcePacks[method](basename(path))
                await pack.importSource(path)
            }
        },
    })

await cli.execute(process.argv.slice(2))

process.on("beforeExit", (code) => {
    if (code == 0) Stopwatch.dump()
})
