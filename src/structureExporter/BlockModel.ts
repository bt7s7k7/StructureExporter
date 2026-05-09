import { vec4 } from "@gltf-transform/core"
import { BlockModelElement } from "./BlockModelElement"
import { BlockState } from "./BlockState"
import { TextureResource } from "./TextureResource"
import { Vector3 } from "./Vector3"
import { warn } from "./log"


export class BlockModel {
    protected readonly _textureVariables = new Map<string, TextureResource | string>()

    public withRotation(rotation: Vector3) {
        return new BlockModel(this.name, this.elements, rotation.mul1(Math.PI / 180).eulerToQuaternionZYX())
            .copyTextureVariables(this)
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

    public copyTextureVariables(from: BlockModel) {
        for (const [key, value] of from._textureVariables) {
            this.setTextureVariable(key, value)
        }
        return this
    }

    constructor(
        public readonly name: string,
        public readonly elements: BlockModelElement[],
        public readonly rotation: vec4 | null,
    ) { }
}

export class BlockModelRouter {
    protected readonly _states: [BlockState, BlockModel][] = []

    public registerModel(state: BlockState, model: BlockModel) {
        this._states.push([state, model])
    }

    public findModel(target: BlockState) {
        for (const [state, model] of this._states) {
            if (state.isSubsetOf(target)) {
                return model
            }
        }

        return null
    }

    public *findModels(target: BlockState) {
        for (const [state, model] of this._states) {
            if (state.isSubsetOf(target)) {
                yield model
            }
        }
    }

    constructor(
        public readonly multipart: boolean,
    ) { }
}
