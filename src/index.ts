import { Document, NodeIO, PropertyType } from "@gltf-transform/core"
import { dedup, flatten, join as join_2 } from "@gltf-transform/functions"
import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { Cli } from "./cli/Cli"
import { Type } from "./struct/Type"
import { BlockBuilder } from "./structureExporter/building/BlockBuilder"
import { Structure } from "./structureExporter/building/Structure"
import { ModelProvider } from "./structureExporter/models/ModelProvider"
import { ResourceProvider } from "./structureExporter/ResourceProvider"
import { info } from "./structureExporter/support/log"
import { Stopwatch } from "./structureExporter/support/Stopwatch"
import { TextureAtlas } from "./structureExporter/textures/TextureAtlas"

const cli = new Cli("structureExporter")
    .addOption({
        name: "", desc: "Exports a structure as a glTF binary embedded file",
        params: [
            ["input", Type.string],
            ["output", Type.string.as(Type.nullable)],
        ],
        options: {
            cache: Type.string.as(Type.nullable),
            simplify: Type.boolean.as(Type.nullable),
            dryRun: Type.boolean.as(Type.nullable),
            dumpAtlas: Type.boolean.as(Type.nullable),
        },
        async callback(input, output, { cache, simplify, dryRun, dumpAtlas }) {
            const resourceProvider = await ResourceProvider.createOrOpen(cache)

            if (output == null) {
                output = join(dirname(input), basename(input, extname(input)) + ".glb")
            } else if (output.endsWith("/")) {
                output += basename(input, extname(input)) + ".glb"
            }

            info(`Converting "${input}" -> "${output}"`)
            const inputData = await readFile(input)
            const structure = await Structure.load(inputData)
            const document = new Document()
            const scene = document.createScene()

            const modelProvider = new ModelProvider(resourceProvider)

            await modelProvider.prepareAssets(structure.palette)

            const atlas = await TextureAtlas.build(document, modelProvider)
            if (dumpAtlas) {
                await writeFile(join(dirname(output), "atlas.png"), atlas.content)
            }

            if (dryRun) return

            const blockBuilder = new BlockBuilder(document, modelProvider, atlas)
            blockBuilder.buildStructure(structure, scene)

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

            await writeFile(output, await new NodeIO().writeBinary(document))

            Stopwatch.dump()
        },
    })
    .addOption({
        name: "import", desc: "Loads mod or minecraft assets into the cache folder",
        params: [
            ["source", Type.string],
        ],
        options: {
            cache: Type.string.as(Type.nullable),
        },
        async callback(source, { cache }) {
            const sources = await ResourceProvider.createOrOpen(cache)
            await sources.importSource(source)
        },
    })

await cli.execute(process.argv.slice(2))
