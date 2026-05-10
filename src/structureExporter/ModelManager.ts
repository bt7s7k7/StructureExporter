import { BlockModel, BlockModelRouter } from "./BlockModel"
import { CubicElement, RotationModelElementDecorator } from "./BlockModelElement"
import { BlockState } from "./BlockState"
import { BlockStatePredicate } from "./BlockStatePredicate"
import { FACE_DOWN, FACE_EAST, FACE_NORTH, FACE_SOUTH, FACE_UP, FACE_WEST } from "./FACES"
import { FaceInfo } from "./FaceInfo"
import { normaliseResourceId, SourceManager } from "./SourceManager"
import { TextureResource } from "./TextureResource"
import { Vector3 } from "./Vector3"
import { warn } from "./log"
import { BlockStateModelReference, Face } from "./minecraft/assets"

export class ModelManager {
    protected readonly _blockModels = new Map<string, BlockModelRouter>()

    public getBlockModels(block: string) {
        return this._blockModels.get(block)
    }

    protected async _addFace(generatedUv: FaceInfo["uv"], element: CubicElement, face: number, data: Face) {
        let uv: FaceInfo["uv"]
        if (data.uv) {
            uv = data.uv
        } else {
            uv = generatedUv
        }

        let texture
        if (data.texture.startsWith("#")) {
            texture = data.texture.slice(1)
        } else {
            const id = normaliseResourceId(data.texture)
            texture = await this.sources.loadTexture(id)
            if (texture == null) {
                warn(`Sources do not include texture file ${id}`)
                texture = TextureResource.getFallback()
            }
        }

        const info = new FaceInfo(texture, uv)
        element.setFaceInfo(face, info)
    }

    protected async _loadModel(id: string, model: BlockModel) {
        const definition = await this.sources.loadModelDefinition(id)
        if (definition == null) {
            warn(`Sources do not include model file ${id}`)
            return false
        }

        if (definition.parent) {
            await this._loadModel(normaliseResourceId(definition.parent), model)
        }

        if (definition.textures) {
            for (const [key, value] of Object.entries(definition.textures)) {
                let texture
                if (value.startsWith("#")) {
                    texture = value.slice(1)
                } else {
                    const id = normaliseResourceId(value)
                    texture = await this.sources.loadTexture(id)
                    if (texture == null) {
                        warn(`Sources do not include texture file ${id}`)
                        texture = TextureResource.getFallback()
                    }
                }

                model.setTextureVariable(key, texture)
            }
        }

        if (definition.elements) {
            model.elements.length = 0

            for (const elementDefinition of definition.elements) {
                const from = Vector3.fromArray(elementDefinition.from)
                const to = Vector3.fromArray(elementDefinition.to)

                const origin = from.add(to).mul1(0.5 * (1 / 16)).sub1(0.5)
                const scale = to.sub(from).mul1(1 / 16)

                let element // Weird syntax for type inference
                element = new CubicElement(model.elements.length, origin.toArray(), scale.toArray())

                const [x1, y1, z1] = from
                const [x2, y2, z2] = to

                if (elementDefinition.faces.down) await this._addFace([x1, z1, x2, z2], element, FACE_DOWN, elementDefinition.faces.down)
                if (elementDefinition.faces.up) await this._addFace([x1, z1, x2, z2], element, FACE_UP, elementDefinition.faces.up)
                if (elementDefinition.faces.south) await this._addFace([x1, y1, x2, y2], element, FACE_SOUTH, elementDefinition.faces.south)
                if (elementDefinition.faces.north) await this._addFace([x1, y1, x2, y2], element, FACE_NORTH, elementDefinition.faces.north)
                if (elementDefinition.faces.east) await this._addFace([z1, y1, z2, y2], element, FACE_EAST, elementDefinition.faces.east)
                if (elementDefinition.faces.west) await this._addFace([z1, y1, z2, y2], element, FACE_WEST, elementDefinition.faces.west)

                if (elementDefinition.rotation) {
                    const rotationOrigin = Vector3.fromArray(elementDefinition.rotation.origin).mul1(1 / 16).sub1(0.5)
                    const originDelta = origin.sub(rotationOrigin)
                    let rotation
                    if ("axis" in elementDefinition.rotation) {
                        rotation = Vector3.ZERO.with(elementDefinition.rotation.axis, elementDefinition.rotation.angle * (Math.PI / 180))
                    } else {
                        const { x, y, z } = elementDefinition.rotation
                        rotation = new Vector3(x, y, z).mul1(Math.PI / 180)
                    }

                    element.translation = originDelta.toArray()
                    element = new RotationModelElementDecorator(element, rotationOrigin.toArray(), rotation.eulerToQuaternionZYX())
                }

                model.elements.push(element)
            }
        }

        return true
    }

    protected _modelCache = new Map<string, BlockModel>()

    public *listUsedTextures() {
        for (const model of this._modelCache.values()) {
            for (const element of model.elements) {
                for (const face of element.getFaces()) {
                    yield model.resolveTexture(face.texture)
                }
            }
        }
    }

    public async prepareAssets(palette: BlockState[]) {
        for (const state of palette) {
            if (this._blockModels.has(state.block)) continue

            const definition = await this.sources.loadBlockStateDefinition(state.block)
            if (definition == null) {
                warn(`Sources do not include block state file ${state.block}`)
                continue
            }

            const multipart = definition.multipart != null
            const router = new BlockModelRouter(multipart)

            if (!multipart) {
                if (definition.variants == null) {
                    warn(`There are no variants or multipart defined in block state file for ${state.block}`)
                    continue
                }

                for (const [key, variant] of Object.entries(definition.variants)) {
                    router.registerModel(BlockStatePredicate.fromString(key), await this._resolveModelReference(state.block, variant))
                }
            } else {
                for (const part of definition.multipart!) {
                    const partState = new BlockState(state.block)
                    if (part.when) {
                        for (const [key, value] of Object.entries(part.when)) {
                            partState.setProperty(key, value)
                        }
                    }

                    router.registerModel(BlockStatePredicate.fromCondition(part.when), await this._resolveModelReference(state.block, part.apply))
                }
            }

            this._blockModels.set(state.block, router)
        }
    }

    protected async _resolveModelReference(owner: string, modelRef: BlockStateModelReference | BlockStateModelReference[]) {
        if (Array.isArray(modelRef)) {
            modelRef = modelRef[0]
        }

        let rotation = Vector3.ZERO

        if (modelRef.x != null) rotation = rotation.with("x", modelRef.x)
        if (modelRef.y != null) rotation = rotation.with("y", modelRef.y)
        if (modelRef.z != null) rotation = rotation.with("z", modelRef.z)

        if (modelRef.model == null) {
            warn("Missing model from model reference")
            return new BlockModel("missing::" + owner, [], null)
        }

        const modelId = normaliseResourceId(modelRef.model)

        let variantModel = this._modelCache.get(modelId)
        if (variantModel == null) {
            variantModel = new BlockModel(modelId, [], null)
            await this._loadModel(modelId, variantModel)
            this._modelCache.set(modelId, variantModel)
        }

        if (!rotation.isZero) {
            variantModel = variantModel.withRotation(rotation)
        }
        return variantModel
    }

    constructor(
        public readonly sources: SourceManager,
    ) { }
}
