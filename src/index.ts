import { Document, NodeIO } from "@gltf-transform/core"
import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { Cli } from "./cli/Cli"
import { Type } from "./struct/Type"
import { CompositeBuilder } from "./structureExporter/CompositeBuilder"
import { info } from "./structureExporter/log"
import { ModelManager } from "./structureExporter/ModelManager"
import { Structure } from "./structureExporter/Structure"

const cli = new Cli("structureExporter").addOption({
    name: "", desc: "Exports a structure as a glTF binary embedded file",
    params: [
        ["input", Type.string],
        ["output", Type.string.as(Type.nullable)],
    ],
    async callback(input, output) {
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

        const modelManager = new ModelManager(document)

        new CompositeBuilder(document, modelManager, scene).addStructure(structure)

        await writeFile(output, await new NodeIO().writeBinary(document))
    },
})

await cli.execute(process.argv.slice(2))
