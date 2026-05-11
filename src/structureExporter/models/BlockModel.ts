import { vec4 } from "@gltf-transform/core"
import { Vector3 } from "../support/Vector3"
import { warn } from "../support/log"
import { TextureResource } from "../textures/TextureResource"
import { BlockModelElement } from "./BlockModelElement"


export class BlockModel {
    protected readonly _textureVariables = new Map<string, TextureResource | string>()
    public readonly rotationQuaternion: vec4 | null = this.rotation == null ? null : (
        this.rotation
            .mul1(Math.PI / 180)
            .mul3(-1, -1, -1) // Ref: minecraft:piston_head[facing=up], cluttered:block/kitchen_set_brown_cabinet_inner_corner
            .eulerToQuaternionZYX()
    )

    public withOptions(rotation: Vector3 | null, lockUv: boolean) {
        return new BlockModel(this.name, this.elements, rotation, lockUv).copyTextureVariablesFrom(this)
    }

    public setTextureVariable(key: string, value: TextureResource | string) {
        this._textureVariables.set(key, value)
        return this
    }

    public getTextureVariable(key: string) {
        let value
        while (true) {
            value = this._textureVariables.get(key)
            if (value == null) return null
            if (typeof value != "string") return value
            key = value
        }
    }

    public resolveTexture(texture: TextureResource | string) {
        if (typeof texture != "string") return texture

        const resolvedTexture = this.getTextureVariable(texture)

        if (resolvedTexture == null) {
            warn(`Cannot resolve texture variable #${texture} in model ${this.name}`)
            return TextureResource.getFallback()
        }

        return resolvedTexture
    }

    public copyTextureVariablesFrom(from: BlockModel) {
        for (const [key, value] of from._textureVariables) {
            this.setTextureVariable(key, value)
        }
        return this
    }

    constructor(
        public readonly name: string,
        public readonly elements: BlockModelElement[],
        public readonly rotation: Vector3 | null,
        public readonly lockUv: boolean,
    ) { }
}
