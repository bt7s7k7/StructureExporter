import { Document, Mesh, Node, vec3, vec4 } from "@gltf-transform/core"
import { BlockState } from "./BlockState"
import { normaliseResourceId, SourceManager } from "./SourceManager"
import { Vector3 } from "./Vector3"
import { warn } from "./log"
import { BlockStateModelReference } from "./minecraft/assets"

export abstract class BlockModelElement {
    public abstract apply(document: Document, node: Node): void
}

export class SimpleModelElement extends BlockModelElement {
    public override apply(document: Document, node: Node): void {
        node
            .setMesh(this.mesh)
            .setTranslation(this.translation)
            .setScale(this.scale)
    }

    constructor(
        public mesh: Mesh,
        public translation: vec3,
        public scale: vec3,
    ) { super() }
}

export class RotationModelElementDecorator extends BlockModelElement {
    public override apply(document: Document, node: Node): void {
        const child = document.createNode("base")
        this.base.apply(document, child)

        node
            .addChild(child)
            .setTranslation(this.translation)
            .setRotation(this.rotation)
    }

    constructor(
        public base: BlockModelElement,
        public translation: vec3,
        public rotation: vec4,
    ) { super() }
}

export class BlockModel {
    public withRotation(rotation: Vector3) {
        return new BlockModel(this.elements, rotation.mul1(Math.PI / 180).eulerToQuaternionZYX())
    }

    constructor(
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

const FACE_DOWN = 1 << 0 // -Y
const FACE_UP = 1 << 1 // +Y
const FACE_NORTH = 1 << 2 // -Z
const FACE_SOUTH = 1 << 3 // +Z
const FACE_WEST = 1 << 4 // -X
const FACE_EAST = 1 << 5 // +X
const ALL_FACES = FACE_DOWN | FACE_UP | FACE_NORTH | FACE_SOUTH | FACE_WEST | FACE_EAST

export class ModelManager {
    protected _meshCache = Array.from<Mesh | null>({ length: 64 }).fill(null)
    protected _buffer = this.document.createBuffer()

    protected _getMeshWithCulledFaces(faceMask: number) {
        if (this._meshCache[faceMask] != null) return this._meshCache[faceMask]!

        const vertices = this.document.createAccessor()
            .setType("VEC3")
            .setArray(new Float32Array([
                -0.5, -0.5, 0.5,  // 0
                0.5, -0.5, 0.5,  // 1
                -0.5, 0.5, 0.5,  // 2
                0.5, 0.5, 0.5,  // 3
                -0.5, -0.5, -0.5,  // 4
                0.5, -0.5, -0.5,  // 5
                -0.5, 0.5, -0.5,  // 6
                0.5, 0.5, -0.5,   // 7
            ]))
            .setBuffer(this._buffer)

        const indexValues = []

        if ((faceMask & FACE_SOUTH) != 0) indexValues.push(0, 1, 2, 1, 3, 2)
        if ((faceMask & FACE_NORTH) != 0) indexValues.push(5, 4, 7, 4, 6, 7)
        if ((faceMask & FACE_WEST) != 0) indexValues.push(4, 0, 6, 0, 2, 6)
        if ((faceMask & FACE_EAST) != 0) indexValues.push(1, 5, 3, 5, 7, 3)
        if ((faceMask & FACE_UP) != 0) indexValues.push(2, 3, 6, 3, 7, 6)
        if ((faceMask & FACE_DOWN) != 0) indexValues.push(4, 5, 0, 5, 1, 0)

        const indices = this.document.createAccessor()
            .setArray(new Uint16Array(indexValues))
            .setBuffer(this._buffer)

        const prim = this.document.createPrimitive()
            .setAttribute("POSITION", vertices)
            .setIndices(indices)

        return this._meshCache[faceMask] = this.document.createMesh("cube_" + faceMask).addPrimitive(prim)
    }

    public applyBlockState(state: BlockState, node: Node) {
        const possibleStates = this._blockStates.get(state.block)
        if (possibleStates == null) {
            // We already warned about this in prepareAssets
            return
        }

        if (possibleStates.multipart) {
            let j = 0

            for (const part of possibleStates.findModels(state)) {
                const partNode = this.document.createNode(`part_${j++}`)
                node.addChild(partNode)

                for (let i = 0; i < part.elements.length; i++) {
                    const child = this.document.createNode(`part_${j}_element_${i}`)
                    part.elements[i].apply(this.document, child)
                    partNode.addChild(child)
                }

                if (part.rotation) {
                    partNode.setRotation(part.rotation)
                }
            }
        } else {
            const model = possibleStates.findModel(state)

            if (model == null) {
                warn(`Failed to find matching model for block state ${state}`)
                return
            }

            if (model.elements.length == 0) return

            for (let i = 0; i < model.elements.length; i++) {
                const child = this.document.createNode(`element_${i}`)
                model.elements[i].apply(this.document, child)
                node.addChild(child)
            }

            if (model.rotation) {
                node.setRotation(model.rotation)
            }
        }
    }

    protected readonly _blockStates = new Map<string, BlockModelRouter>()

    protected async _loadModel(id: string, elements: BlockModelElement[]) {
        const definition = await this.sources.loadModelDefinition(id)
        if (definition == null) {
            warn(`Sources do not include model file ${id}`)
            return false
        }

        if (definition.parent) {
            await this._loadModel(normaliseResourceId(definition.parent), elements)
        }

        if (definition.elements) {
            elements.length = 0

            for (const elementDefinition of definition.elements) {
                const from = Vector3.fromArray(elementDefinition.from)
                const to = Vector3.fromArray(elementDefinition.to)

                const origin = from.add(to).mul1(0.5 * (1 / 16)).sub1(0.5)
                const scale = to.sub(from).mul1(1 / 16)

                let faceMask = 0

                if ("down" in elementDefinition.faces) faceMask |= FACE_DOWN
                if ("up" in elementDefinition.faces) faceMask |= FACE_UP
                if ("south" in elementDefinition.faces) faceMask |= FACE_SOUTH
                if ("north" in elementDefinition.faces) faceMask |= FACE_NORTH
                if ("east" in elementDefinition.faces) faceMask |= FACE_EAST
                if ("west" in elementDefinition.faces) faceMask |= FACE_WEST

                let element // Weird syntax for type inference
                element = new SimpleModelElement(this._getMeshWithCulledFaces(faceMask), origin.toArray(), scale.toArray())

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

                elements.push(element)
            }
        }

        return true
    }

    protected _modelCache = new Map<string, BlockModel>()

    public async prepareAssets(palette: BlockState[]) {
        for (const state of palette) {
            if (this._blockStates.has(state.block)) continue

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
                    const variantState = new BlockState(state.block).addPropertiesFromString(key)
                    router.registerModel(variantState, await this._resolveModelReference(variant))
                }
            } else {
                for (const part of definition.multipart!) {
                    const partState = new BlockState(state.block)
                    if (part.when) {
                        for (const [key, value] of Object.entries(part.when)) {
                            partState.setProperty(key, value)
                        }
                    }

                    router.registerModel(partState, await this._resolveModelReference(part.apply))
                }
            }

            this._blockStates.set(state.block, router)
        }
    }

    protected async _resolveModelReference(modelRef: BlockStateModelReference | BlockStateModelReference[]) {
        if (Array.isArray(modelRef)) {
            modelRef = modelRef[0]
        }

        let rotation = Vector3.ZERO

        if (modelRef.x != null) rotation = rotation.with("x", modelRef.x)
        if (modelRef.y != null) rotation = rotation.with("y", modelRef.y)
        if (modelRef.z != null) rotation = rotation.with("z", modelRef.z)

        if (modelRef.model == null) {
            warn("Missing model from model reference")
            return new BlockModel([], null)
        }

        const modelId = normaliseResourceId(modelRef.model)

        let variantModel = this._modelCache.get(modelId)
        if (variantModel == null) {
            const elements: BlockModelElement[] = []
            await this._loadModel(modelId, elements)
            variantModel = new BlockModel(elements, null)
            this._modelCache.set(modelId, variantModel)
        }

        if (!rotation.isZero) {
            variantModel = variantModel.withRotation(rotation)
        }
        return variantModel
    }

    constructor(
        public readonly document: Document,
        public readonly sources: SourceManager,
    ) { }
}
