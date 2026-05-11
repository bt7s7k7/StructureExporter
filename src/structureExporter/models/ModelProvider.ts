import { BlockState } from "../building/BlockState"
import { BlockStateModelReference, Face } from "../minecraft/assets"
import { normaliseResourceId, ResourceProvider } from "../resources/ResourceProvider"
import { FACE_DOWN, FACE_EAST, FACE_NORTH, FACE_SOUTH, FACE_UP, FACE_WEST } from "../support/FACES"
import { Stopwatch } from "../support/Stopwatch"
import { Vector3 } from "../support/Vector3"
import { warn } from "../support/log"
import { TextureResource } from "../textures/TextureResource"
import { BlockModel } from "./BlockModel"
import { CubicElement, RotationModelElementDecorator } from "./BlockModelElement"
import { BlockRenderingInfo } from "./BlockRenderingInfo"
import { BlockStatePredicate } from "./BlockStatePredicate"
import { FaceInfo } from "./FaceInfo"

export class ModelProvider {
    protected readonly _blockRenderingInfo = new Map<string, BlockRenderingInfo>()

    public getBlockRenderingInfo(block: string) {
        return this._blockRenderingInfo.get(block)
    }

    protected _textureCache = new Map<string, TextureResource>()
    protected async _loadTexture(id: string) {
        let texture

        texture = this._textureCache.get(id)
        if (texture != null) return texture

        texture = await this.resourceProvider.loadTexture(id)
        if (texture == null) {
            warn(`Sources do not include texture file ${id}`)
            texture = TextureResource.getFallback()
        }

        this._textureCache.set(id, texture)
        return texture

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
            texture = await this._loadTexture(normaliseResourceId(data.texture))
        }

        const info = new FaceInfo(texture, uv, data.rotation ?? 0)
        element.setFaceInfo(face, info)
    }

    protected async _loadModel(id: string, model: BlockModel) {
        const definition = await this.resourceProvider.loadModelDefinition(id)
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
                    texture = await this._loadTexture(normaliseResourceId(value))
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
                // Having scale with any components of value zero, will cause the glTF
                // simplification process to calculate matrixes with NaN fields, causing a crash.
                // This only happens when the process picks a node with NaN values as the first node
                // in a material group, which is pretty random so the issue is hard to diagnose.
                const scale = to.sub(from).mul1(1 / 16).withoutZeroes()

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

    public async prepareAssets(palette: Iterable<BlockState>) {
        using stopwatch = new Stopwatch()
        stopwatch.start("prepareAssets/load")

        for (const state of palette) {
            if (this._blockRenderingInfo.has(state.block)) continue

            const definition = await this.resourceProvider.loadBlockStateDefinition(state.block)
            if (definition == null) {
                warn(`Sources do not include block state file ${state.block}`)
                const info = new BlockRenderingInfo(false)
                const model = await this._resolveModelReference(state.block, null)
                info.registerModel(BlockStatePredicate.fromString(""), new BlockModel(state.block, [CubicElement.getFallback()], null, false))
                this._blockRenderingInfo.set(state.block, info)
                continue
            }

            const isMultipart = definition.multipart != null
            const info = new BlockRenderingInfo(isMultipart)

            if (!isMultipart) {
                if (definition.variants == null) {
                    warn(`There are no variants or multipart defined in block state file for ${state.block}`)
                    continue
                }

                for (const [key, variant] of Object.entries(definition.variants)) {
                    info.registerModel(BlockStatePredicate.fromString(key), await this._resolveModelReference(state.block, variant))
                }
            } else {
                for (const part of definition.multipart!) {
                    const partState = new BlockState(state.block)
                    if (part.when) {
                        for (const [key, value] of Object.entries(part.when)) {
                            partState.setProperty(key, value)
                        }
                    }

                    info.registerModel(BlockStatePredicate.fromCondition(part.when), await this._resolveModelReference(state.block, part.apply))
                }
            }

            this._blockRenderingInfo.set(state.block, info)
        }

        stopwatch.start("prepareAssets/culling")
        // Check what models are full blocks and opaque for face culling
        for (const info of this._blockRenderingInfo.values()) {
            forModels: for (const model of info.getModels()) {
                do {
                    if (model.elements.length != 1) break

                    const element = model.elements[0]
                    if (!(element instanceof CubicElement)) break

                    // Check if the element is a full block
                    if (
                        element.scale[0] != 1
                        || element.scale[1] != 1
                        || element.scale[2] != 1
                        || element.translation[0] != 0
                        || element.translation[1] != 0
                        || element.translation[2] != 0
                    ) {
                        break
                    }

                    // If we already know the block is not opaque, we don't need to check the textures
                    if (!info.isOpaque) continue forModels

                    for (const face of element.getFaces()) {
                        const texture = model.resolveTexture(face.texture)
                        if (texture.transparency != "opaque") {
                            info.isOpaque = false
                            break
                        }
                    }

                    continue forModels
                } while (false)

                info.isFullBlock = false
                break
            }

            if (!info.isFullBlock) {
                info.isOpaque = false
                continue
            }
        }
    }

    protected _fallbackModel: BlockModel | null = null

    protected async _resolveModelReference(owner: string, modelRef: BlockStateModelReference | BlockStateModelReference[] | null) {
        if (Array.isArray(modelRef)) {
            modelRef = modelRef[0]
        }

        let model
        if (modelRef == null || modelRef.model == null) {
            warn("Missing model from model reference in " + owner)
            if (this._fallbackModel) {
                model = this._fallbackModel
            } else {
                model = new BlockModel("missing", [CubicElement.getFallback()], null, false)
                this._modelCache.set(model.name, model)
                this._fallbackModel = model
            }
        } else {
            const modelId = normaliseResourceId(modelRef.model)

            model = this._modelCache.get(modelId)
            if (model == null) {
                model = new BlockModel(modelId, [], null, false)
                await this._loadModel(modelId, model)
                this._modelCache.set(modelId, model)
            }
        }

        if (modelRef == null) return model

        let rotation = Vector3.ZERO

        if (modelRef.x != null) rotation = rotation.with("x", modelRef.x)
        if (modelRef.y != null) rotation = rotation.with("y", modelRef.y)
        if (modelRef.z != null) rotation = rotation.with("z", modelRef.z)

        if (!rotation.isZero || modelRef.uvlock) {
            model = model.withOptions(rotation, !!modelRef.uvlock)
        }

        return model
    }

    constructor(
        public readonly resourceProvider: ResourceProvider,
    ) { }
}
