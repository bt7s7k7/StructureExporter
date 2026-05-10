import { Document, Mesh, Node, Scene } from "@gltf-transform/core"
import { compactPrimitive } from "@gltf-transform/functions"
import { unreachable } from "../comTypes/util"
import { TextureAtlas } from "./AtlasManager"
import { BlockModel } from "./BlockModel"
import { BlockState } from "./BlockState"
import { FaceInfo } from "./FaceInfo"
import { FACE_ALL, FACE_DOWN, FACE_EAST, FACE_NORTH, FACE_SOUTH, FACE_UP, FACE_WEST } from "./FACES"
import { warn } from "./log"
import { ModelManager } from "./ModelManager"
import { Structure } from "./Structure"
import { TextureResource } from "./TextureResource"
import { Vector3 } from "./Vector3"

const _NEIGHBOURS = [
    [FACE_EAST, new Vector3(1, 0, 0)],
    [FACE_UP, new Vector3(0, 1, 0)],
    [FACE_SOUTH, new Vector3(0, 0, 1)],
    [FACE_WEST, new Vector3(-1, 0, 0)],
    [FACE_DOWN, new Vector3(0, -1, 0)],
    [FACE_NORTH, new Vector3(0, 0, -1)],
] as const

const _FACE_DATA = [
    // Vertex data: 4 vertices, each has 3 components
    // 2---3
    // |   |
    // 0---1
    [FACE_SOUTH, [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5]],
    [FACE_NORTH, [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]],
    [FACE_WEST, [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5]],
    [FACE_EAST, [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5]],
    [FACE_UP, [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5]],
    [FACE_DOWN, [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]],
] as const

export class BlockBuilder {
    protected _meshCache = new Map<string, Mesh>()
    protected _buffer = this.document.createBuffer()

    public buildStructure(structure: Structure, root: Node | Scene) {
        for (const block of structure.blocks) {
            const pos = Vector3.fromArray(block.pos)
            const state = structure.palette[block.state]
            const node = this.document.createNode(`(${pos.toMapKey()})${state.toString()}`)
                .setTranslation(pos.toArray())

            this.buildBlockState(pos, state, node, structure)

            root.addChild(node)
        }
    }

    public getBlockMesh(model: BlockModel, elementIdx: number, faceMask: number, faces: (FaceInfo | null)[]) {
        const key = `${model.name}_${elementIdx}_${faceMask}`
        const existing = this._meshCache.get(key)
        if (existing) return existing

        const vertexValues: number[] = []
        const indexValues: number[] = []
        const uvValues: number[] = []

        let indexStart = 0
        let transparency: TextureResource["transparency"] = "opaque"

        for (const [face, vertices] of _FACE_DATA) {
            if ((faceMask & face) == 0) continue

            indexValues.push(indexStart + 0, indexStart + 1, indexStart + 2, indexStart + 1, indexStart + 3, indexStart + 2)

            // Increment index start by 4 because we will add 4 vertices
            indexStart += 4

            vertexValues.push(...vertices)

            const index = 31 - Math.clz32(face)
            const faceInfo = faces[index] ?? unreachable()
            const texture = model.resolveTexture(faceInfo.texture)

            if (transparency == "opaque") {
                if (texture.transparency != "opaque") transparency = texture.transparency
            } else if (transparency == "scissor") {
                if (texture.transparency == "transparent") transparency = "transparent"
            }

            uvValues.push(...this.atlas.getUVs(texture, faceInfo))
        }

        const vertices = this.document.createAccessor()
            .setType("VEC3")
            .setArray(new Float32Array(vertexValues))
            .setBuffer(this._buffer)

        const uvs = this.document.createAccessor()
            .setType("VEC2")
            .setArray(new Float32Array(uvValues))
            .setBuffer(this._buffer)

        const indices = this.document.createAccessor()
            .setArray(new Uint16Array(indexValues))
            .setBuffer(this._buffer)

        const prim = this.document.createPrimitive()
            .setAttribute("POSITION", vertices)
            .setAttribute("TEXCOORD_0", uvs)
            .setIndices(indices)
            .setMaterial(transparency == "opaque" ? (
                this.atlas.getOpaqueMaterial()
            ) : transparency == "scissor" ? (
                this.atlas.getScissorMaterial()
            ) : transparency == "transparent" ? (
                this.atlas.getTransparentMaterial()
            ) : unreachable())

        compactPrimitive(prim)

        const mesh = this.document.createMesh(key)
            .addPrimitive(prim)

        this._meshCache.set(key, mesh)
        return mesh
    }

    public buildBlockState(pos: Vector3, state: BlockState, node: Node, context: Structure) {
        const info = this.models.getBlockRenderingInfo(state.block)
        if (info == null) {
            // We already warned about this in ModelManager.prepareAssets
            return
        }

        let faceMask = FACE_ALL

        if (info.isFullBlock) {
            // Only do culling for full blocks, it's not necessarily accurate, but it will be good
            // enough to eliminate most of the useless faces.
            for (const [face, offset] of _NEIGHBOURS) {
                const neighbourPosition = pos.add(offset)

                const neighbour = context.getBlock(neighbourPosition)
                if (neighbour == null) continue

                const neighbourBlock = context.palette[neighbour.state].block
                const neighbourInfo = this.models.getBlockRenderingInfo(neighbourBlock)
                if (neighbourInfo == null) continue

                if (!neighbourInfo.isFullBlock) continue

                if (neighbourInfo.isOpaque) {
                    faceMask ^= face
                    continue
                }

                // If the neighbour is not opaque, we cull only if it's the same block (e.g. for glass faces)
                if (state.block == neighbourBlock) {
                    faceMask ^= face
                }
            }
        }

        if (info.multipart) {
            let j = 0

            for (const part of info.findModels(state)) {
                let rotatedFaceMask = faceMask
                if (part.rotation) {
                    // TODO
                }

                const partNode = this.document.createNode(`part_${j++}`)
                node.addChild(partNode)

                for (let i = 0; i < part.elements.length; i++) {
                    const child = this.document.createNode(`part_${j}_element_${i}`)
                    part.elements[i].apply(child, part, rotatedFaceMask, this.document, this)
                    partNode.addChild(child)
                }

                if (part.rotation) {
                    partNode.setRotation(part.rotation)
                }
            }
        } else {
            const model = info.findModel(state)

            if (model == null) {
                warn(`Failed to find matching model for block state ${state}`)
                return
            }

            let rotatedFaceMask = faceMask
            if (model.rotation) {
                // TODO
            }

            if (model.elements.length == 0) return

            for (let i = 0; i < model.elements.length; i++) {
                const child = this.document.createNode(`element_${i}`)
                model.elements[i].apply(child, model, rotatedFaceMask, this.document, this)
                node.addChild(child)
            }

            if (model.rotation) {
                node.setRotation(model.rotation)
            }
        }
    }

    constructor(
        public readonly document: Document,
        public readonly models: ModelManager,
        public readonly atlas: TextureAtlas,
    ) { }
}
