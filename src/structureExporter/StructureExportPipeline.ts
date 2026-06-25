import { Document, PropertyType } from "@gltf-transform/core"
import { dedup } from "@gltf-transform/functions"
import { BlockBuilder } from "./building/BlockBuilder"
import { Structure } from "./building/Structure"
import { ModelProvider } from "./models/ModelProvider"
import { Platform } from "./Platform"
import { Plugin } from "./plugins/Plugin"
import { PluginManager } from "./plugins/PluginManager"
import { ResourcePackManager } from "./resources/ResourcePackManager"
import { ResourceProvider } from "./resources/ResourceProvider"
import { Stopwatch } from "./support/Stopwatch"
import { TextureAtlas } from "./textures/TextureAtlas"

export class StructureExportPipeline {
    protected readonly _resourcePacks = new Map<string | null, ResourcePackManager>()

    public async getResourcePacks(path: string | null) {
        let resourcePacks = this._resourcePacks.get(path)
        if (resourcePacks != null) return resourcePacks

        resourcePacks = await ResourcePackManager.createOrOpen(this.platform, path)
        this._resourcePacks.set(path, resourcePacks)
        return resourcePacks
    }

    public async execute(input: string, output: string, resourcePath: string | null, pluginSources: ((() => Plugin) | string)[], stage: "assets" | "full") {
        const _PLATFORM = this.platform
        const resourcePacks = await this.getResourcePacks(resourcePath)
        const plugins = new PluginManager(this.platform)

        for (const pluginSource of pluginSources) {
            if (typeof pluginSource == "string") {
                await plugins.loadPlugin(pluginSource)
            } else {
                plugins.addPlugin(pluginSource())
            }
        }

        await plugins.executeHandlerAsync("onInit", this.platform, input, output)

        const resourceProvider = new ResourceProvider(plugins, this.platform, resourcePacks)

        const inputData = await this.platform.read(input)
        const structure = await Structure.load(plugins, inputData.buffer as ArrayBuffer)
        const document = new Document()
        const scene = document.createScene()

        const modelProvider = new ModelProvider(resourceProvider)

        await plugins.executeHandlerAsync("onBeforePrepareAssets", structure, resourceProvider, modelProvider)

        await modelProvider.prepareAssets([...structure.getAssets()])

        await plugins.executeHandlerAsync("onPrepareAssets", structure, resourceProvider, modelProvider)

        const atlas = await TextureAtlas.build(_PLATFORM, document, modelProvider, plugins)

        if (stage == "assets") return

        const blockBuilder = new BlockBuilder(document, modelProvider, atlas)
        await plugins.executeHandlerAsync("onBeforeBuild", blockBuilder, structure, scene)

        blockBuilder.buildStructure(structure, scene)

        await plugins.executeHandlerAsync("onBuild", document, scene)

        const stopwatch = new Stopwatch().start("simplify")

        const transforms = [
            dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
        ]

        await plugins.executeHandlerAsync("onBeforeOptimisation", document, transforms)

        await document.transform(...transforms)
        stopwatch.end()

        await plugins.executeHandlerAsync("onBeforeWrite", document, scene)

        return document
    }


    constructor(
        public readonly platform: Platform,
    ) { }
}
