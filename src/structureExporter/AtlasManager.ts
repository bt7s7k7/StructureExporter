import { Document, Material, Texture, TextureInfo } from "@gltf-transform/core"
import { ModelManager } from "./ModelManager"
// @ts-ignore
import layout from "layout"
import sharp from "sharp"
import { unreachable } from "../comTypes/util"
import { FaceInfo } from "./FaceInfo"
import { Stopwatch } from "./Stopwatch"
import { TextureResource } from "./TextureResource"

interface AtlasLayout<T> {
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

    protected _scissorMaterial: Material | null = null
    public getScissorMaterial() {
        return this._scissorMaterial ??= this._createTextureMaterial("block_scissor")
            .setAlphaMode("MASK")
    }

    protected _transparentMaterial: Material | null = null
    public getTransparentMaterial() {
        return this._transparentMaterial ??= this._createTextureMaterial("block_transparent")
            .setAlphaMode("BLEND")
    }

    public getUVs(texture: TextureResource, face: FaceInfo) {
        let [x1, y1, x2, y2] = face.uv

        let uv
        const rotation = face.rotation
        switch (rotation) {
            case 0:
                uv = [
                    x1, y2,
                    x2, y2,
                    x1, y1,
                    x2, y1,
                ]
                break
            case 90:
                uv = [
                    x2, y2,
                    x2, y1,
                    x1, y2,
                    x1, y1,
                ]
                break
            case 180:
                uv = [
                    x2, y1,
                    x1, y1,
                    x2, y2,
                    x1, y2,
                ]
                break
            case 270:
                uv = [
                    x1, y1,
                    x1, y2,
                    x2, y1,
                    x2, y2,
                ]
                break
        }

        for (let i = 0; i < uv.length; i += 2) {
            uv[i] = (uv[i] + texture.x) / this.width
            uv[i + 1] = (uv[i + 1] + texture.y) / this.height
        }

        return uv
    }

    protected constructor(
        public readonly textures: TextureResource[],
        public readonly document: Document,
        public readonly width: number,
        public readonly height: number,
        public readonly texture: Texture,
        public readonly content: Buffer,
    ) { }

    public static async build(document: Document, models: ModelManager) {
        const textures = [...new Set(models.listUsedTextures())]
        const atlasBuilder = layout("binary-tree")

        for (const texture of textures) {
            atlasBuilder.addItem({ width: texture.width, height: texture.height, meta: texture })
        }

        const atlasLayout: AtlasLayout<TextureResource> = atlasBuilder.export()
        const atlas = sharp({
            create: {
                width: atlasLayout.width,
                height: atlasLayout.height,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                channels: 4,
            },
        }).png()

        const stopwatch = new Stopwatch().start("atlas/composite")

        atlas.composite(await Promise.all(atlasLayout.items.map(async item => {
            const texture = item.meta

            texture.x = item.x
            texture.y = item.y

            return {
                input: await texture.image.png().toBuffer(),
                left: item.x,
                top: item.y,
            }
        })))

        const atlasData = await atlas.toBuffer()

        stopwatch.end()

        const texture = document
            .createTexture("atlas")
            .setImage(atlasData)
            .setMimeType("image/png")

        return new TextureAtlas(textures, document, atlasLayout.width, atlasLayout.height, texture, atlasData)
    }
}
