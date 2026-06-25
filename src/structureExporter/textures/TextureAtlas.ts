import { Document, Material, Texture, TextureInfo } from "@gltf-transform/core"
import { ModelProvider } from "../models/ModelProvider"
// @ts-ignore
import layout from "layout"
import { runString, unreachable } from "../../comTypes/util"
import { Drawer } from "../../drawer/Drawer"
import { Point } from "../../drawer/Point"
import { Platform } from "../Platform"
import { Stopwatch } from "../support/Stopwatch"
import { TextureResource } from "./TextureResource"
import { PluginManager } from "../plugins/PluginManager"

export interface AtlasLayout<T> {
    height: number
    width: number
    items: {
        x: number
        y: number
        height: number
        width: number
        meta: T
    }[]
}


export class TextureAtlas {
    protected _createTextureMaterial(name: string) {
        const material = this.document.createMaterial(name)
            .setBaseColorTexture(this.texture)
            .setMetallicFactor(0)
            .setRoughnessFactor(1)

        const info = material.getBaseColorTextureInfo() ?? unreachable()
        info.setMinFilter(TextureInfo.MinFilter.NEAREST)
        info.setMagFilter(TextureInfo.MagFilter.NEAREST)

        return material
    }

    protected _opaqueMaterial: Material | null = null
    public getOpaqueMaterial() {
        return this._opaqueMaterial ??= this._createTextureMaterial("block_opaque")
            .setAlphaMode("OPAQUE")
    }

    protected _cutoffMaterial: Material | null = null
    public getCutoffMaterial() {
        return this._cutoffMaterial ??= this._createTextureMaterial("block_cutoff")
            .setAlphaMode("MASK")
    }

    protected _transparentMaterial: Material | null = null
    public getTransparentMaterial() {
        return this._transparentMaterial ??= this._createTextureMaterial("block_transparent")
            .setAlphaMode("BLEND")
    }

    protected constructor(
        public readonly textures: TextureResource[],
        public readonly document: Document,
        public readonly width: number,
        public readonly height: number,
        public readonly texture: Texture,
        public readonly content: Uint8Array,
    ) { }

    public static async build(platform: Platform, document: Document, models: ModelProvider, plugins: PluginManager) {
        const textures = [...new Set(models.listUsedTextures())]
        const atlasBuilder = layout("binary-tree")

        for (const texture of textures) {
            atlasBuilder.addItem({ width: texture.width, height: texture.height, meta: texture })
        }

        const atlasLayout: AtlasLayout<TextureResource> = atlasBuilder.export()
        const atlas = Drawer.withSize(atlasLayout)

        const stopwatch = new Stopwatch().start("atlas/composite")

        for (const item of atlasLayout.items) {
            const texture = item.meta

            texture.x = item.x
            texture.y = item.y

            atlas.blit(texture.image, new Point(item))
        }

        const atlasData = await platform.saveImage(atlas)

        stopwatch.end()

        const texture = document
            .createTexture("atlas")
            .setImage(atlasData)
            .setMimeType("image/png")

        const result = new TextureAtlas(textures, document, atlasLayout.width, atlasLayout.height, texture, atlasData)
        await plugins.executeHandlerAsync("onTextureAtlasBuilt", result, atlasLayout)
        return result
    }
}
