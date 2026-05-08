import { Document, NodeIO } from "@gltf-transform/core"
import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { Cli } from "./cli/Cli"
import { Type } from "./struct/Type"
import { CompositeBuilder } from "./structureExporter/CompositeBuilder"
import { info } from "./structureExporter/log"
import { ModelManager } from "./structureExporter/ModelManager"
import { SourceManager } from "./structureExporter/SourceManager"
import { Structure } from "./structureExporter/Structure"

const cli = new Cli("structureExporter")
    .addOption({
        name: "", desc: "Exports a structure as a glTF binary embedded file",
        params: [
            ["input", Type.string],
            ["output", Type.string.as(Type.nullable)],
        ],
        options: {
            cache: Type.string.as(Type.nullable),
        },
        async callback(input, output, { cache }) {
            const sources = await SourceManager.createOrOpen(cache)

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

            const modelManager = new ModelManager(document, sources)

            await new CompositeBuilder(document, modelManager, scene).addStructure(structure)

            await writeFile(output, await new NodeIO().writeBinary(document))
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
            const sources = await SourceManager.createOrOpen(cache)
            await sources.importSource(source)
        },
    })

await cli.execute(process.argv.slice(2))
