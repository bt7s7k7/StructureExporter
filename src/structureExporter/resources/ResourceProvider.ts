import { join } from "node:path"
import { Drawer } from "../../drawer/Drawer"
import { BlockStateDefinition, ModelDefinition, TextureAnimationDefinition } from "../minecraft/assets"
import { decodeString, Platform } from "../Platform"
import { PluginManager } from "../plugins/PluginManager"
import { Stopwatch } from "../support/Stopwatch"
import { TextureResource } from "../textures/TextureResource"
import { memoizeMethods } from "./memoMethods"
import { ResourcePackManager } from "./ResourcePackManager"

export function normaliseResourceId(id: string) {
    if (!id.includes(":")) return "minecraft:" + id
    return id
}

export class ResourceProvider {
    public async loadBlockStateDefinition(id: string) {
        {
            let value = await this.plugins.executeHookAsync("onBeforeLoadBlockStateDefinition", null, id)
            if (value != null) return value
        }

        const [namespace, path] = id.split(":")
        const content = await this.resourcePacks.loadResource(join("assets", namespace, "blockstates", path + ".json"))
        if (content == null) {
            return null
        }

        const definition = JSON.parse(decodeString(content)) as BlockStateDefinition
        return await this.plugins.executeHookAsync("onLoadBlockStateDefinition", definition, id)
    }

    public async loadModelDefinition(id: string) {
        {
            let value = await this.plugins.executeHookAsync("onBeforeLoadModelDefinition", null, id)
            if (value != null) return value
        }

        const [namespace, path] = id.split(":")
        const content = await this.resourcePacks.loadResource(join("assets", namespace, "models", path + ".json"))
        if (content == null) {
            return null
        }

        const definition = JSON.parse(decodeString(content)) as ModelDefinition
        return await this.plugins.executeHookAsync("onLoadModelDefinition", definition, id)
    }

    public async loadTexture(id: string) {
        {
            let value = await this.plugins.executeHookAsync("onBeforeLoadTexture", null, id)
            if (value != null) return value
        }

        const [namespace, path] = id.split(":")
        const fullPath = join("assets", namespace, "textures", path + ".png")
        const content = await this.resourcePacks.loadResource(fullPath)
        if (content == null) {
            return null
        }

        let image = Drawer.from(await this.platform.loadImage(content))
        let { width, height } = image.size

        // Check for animated textures to only cut out the first frame
        const metadataFile = await this.resourcePacks.loadResource(fullPath + ".mcmeta")
        if (metadataFile != null) {
            const metadata: TextureAnimationDefinition = JSON.parse(decodeString(metadataFile));

            [width, height] = [
                metadata.animation.width ?? (metadata.animation.height != null ? width : Math.min(width, height)),
                metadata.animation.height ?? (metadata.animation.width != null ? height : Math.min(width, height)),
            ]

            image = new Drawer().matchSize({ width, height }).blit(image)
        }

        image = await this.plugins.executeHookAsync("onLoadTextureContent", image, id)

        let transparency: TextureResource["transparency"] = "opaque"
        const stopwatch = new Stopwatch()

        stopwatch.start("imageAnalysis/load")

        const data = image.getImageData().data

        stopwatch.start("imageAnalysis/work")

        for (let i = 3 /* Start at 3, which is the alpha channel */; i < data.length; i += 4) {
            const alpha = data[i]
            if (alpha == 0) {
                if (transparency == "opaque") transparency = "cutoff"
            } else if (alpha < 255) {
                transparency = "transparent"
            }
        }

        stopwatch.end()

        const definition = new TextureResource(width, height, transparency, image)
        return await this.plugins.executeHookAsync("onLoadTexture", definition, id)
    }

    constructor(
        public readonly plugins: PluginManager,
        public readonly platform: Platform,
        public readonly resourcePacks: ResourcePackManager,
    ) {
        memoizeMethods(this, [
            "loadBlockStateDefinition",
            "loadModelDefinition",
            "loadTexture",
        ])
    }
}
