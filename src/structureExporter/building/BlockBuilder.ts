import { Document, Mesh, Node, Scene } from "@gltf-transform/core"
import { compactPrimitive } from "@gltf-transform/functions"
import { unreachable } from "../../comTypes/util"
import { BlockModel } from "../models/BlockModel"
import { FaceInfo } from "../models/FaceInfo"
import { ModelProvider } from "../models/ModelProvider"
import { FACE_ALL, FACE_DOWN, FACE_EAST, FACE_NORTH, FACE_SOUTH, FACE_UP, FACE_WEST } from "../support/FACES"
import { Stopwatch } from "../support/Stopwatch"
import { Vector3 } from "../support/Vector3"
import { warn } from "../support/log"
import { TextureAtlas } from "../textures/TextureAtlas"
import { TextureResource } from "../textures/TextureResource"
import { BlockState } from "./BlockState"
import { Structure } from "./Structure"

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

function _getUVs(texture: TextureResource, face: FaceInfo, direction: number, rotation: Vector3 | null, atlas: TextureAtlas) {
    let [x1, y1, x2, y2] = face.uv

    // Transform the texture coordinates into 0..1 range for easier manipulation. All texture
    // coordinates assume the associated texture is 16x16, so divide the coordinates by 16.
    x1 *= 0.0625
    y1 *= 0.0625
    x2 *= 0.0625
    y2 *= 0.0625

    let uv
    switch (face.rotation) {
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

    // Rotation code inspired by BramStoutProductions/MiEx
    // Source: https://github.com/BramStoutProductions/MiEx/blob/main/src/nl/bramstout/mcworldexporter/model/ModelFace.java
    // Method: ModelFace.rotate
    if (rotation != null) {
        if (direction == FACE_WEST || direction == FACE_EAST) {
            let angle = rotation.x
            if (direction == FACE_EAST) angle = 360 - angle
            switch (angle) {
                case 90: {
                    for (let i = 0; i < uv.length; i += 2) {
                        let x = uv[i + 1]
                        let y = -(uv[i] - 0.5) + 0.5
                        uv[i] = x
                        uv[i + 1] = y
                    }
                    break
                }
                case 180:
                    for (let i = 0; i < uv.length; i += 2) {
                        uv[i] = 1 - uv[i]
                        uv[i + 1] = 1 - uv[i + 1]
                    }
                    break
                case 270: {
                    for (let i = 0; i < uv.length; i += 2) {
                        let x = -(uv[i + 1] - 0.5) + 0.5
                        let y = uv[i]
                        uv[i] = x
                        uv[i + 1] = y
                    }
                    break
                }
            }
        }

        {
            let angle = rotation.x
            while (angle >= 90) {
                angle -= 90

                if (direction == FACE_DOWN) {
                    direction = FACE_SOUTH
                } else if (direction == FACE_SOUTH) {
                    direction = FACE_UP
                } else if (direction == FACE_UP) {
                    direction = FACE_NORTH

                    for (let i = 0; i < uv.length; i += 2) {
                        uv[i] = 1 - uv[i]
                        uv[i + 1] = 1 - uv[i + 1]
                    }
                } else if (direction == FACE_NORTH) {
                    direction = FACE_DOWN

                    for (let i = 0; i < uv.length; i += 2) {
                        uv[i] = 1 - uv[i]
                        uv[i + 1] = 1 - uv[i + 1]
                    }
                }
            }
        }

        if (direction == FACE_DOWN || direction == FACE_UP) {
            let angle = rotation.y
            if (direction == FACE_UP) angle = 360 - angle
            switch (angle) {
                case 90: {
                    for (let i = 0; i < uv.length; i += 2) {
                        let x = uv[i + 1]
                        let y = -(uv[i] - 0.5) + 0.5
                        uv[i] = x
                        uv[i + 1] = y
                    }
                    break
                }
                case 180:
                    for (let i = 0; i < uv.length; i += 2) {
                        uv[i] = 1 - uv[i]
                        uv[i + 1] = 1 - uv[i + 1]
                    }
                    break
                case 270: {
                    for (let i = 0; i < uv.length; i += 2) {
                        let x = -(uv[i + 1] - 0.5) + 0.5
                        let y = uv[i]
                        uv[i] = x
                        uv[i + 1] = y
                    }
                    break
                }
            }
        }
    }

    // The UVs are in local coordinates to the texture, convert them to global coordinates. First
    // remap the UVs to pixel coordinates then translate them according to the textures position in
    // the atlas. Finally transform them back to UVs with the atlas size.
    for (let i = 0; i < uv.length; i += 2) {
        uv[i] = (uv[i] * texture.width + texture.x) / atlas.width
        uv[i + 1] = (uv[i + 1] * texture.height + texture.y) / atlas.height
    }

    return uv
}

export class BlockBuilder {
    public cullEdges = false

    protected _meshCache = new Map<string, Mesh>()
    protected _buffer = this.document.createBuffer()

    public buildStructure(structure: Structure, root: Node | Scene) {
        const stopwatch = new Stopwatch().start("buildStructure")
        for (const [pos, state] of structure.getBlocks()) {
            const node = this.document.createNode(`(${pos.toMapKey()})${state.toString()}`)
                .setTranslation(pos.toArray())

            this._buildBlockState(pos, state, node, structure)

            root.addChild(node)
        }
        stopwatch.end()

        let idx = 0
        for (const substructure of structure.substructures) {
            const node = this.document.createNode(`substructure_${idx++}`)
                .setTranslation(substructure.position.toArray())
                .setRotation(substructure.rotation.eulerToQuaternionZYX())
            root.addChild(node)
            this.buildStructure(substructure, node)
        }
    }

    public buildElementMesh(model: BlockModel, elementIdx: number, faceMask: number, faces: (FaceInfo | null)[]) {
        using stopwatch = new Stopwatch().start("buildElementMesh")
        let key = `${model.name}_${elementIdx}_${faceMask}`
        let rotation: Vector3 | null = null
        if (model.lockUv && model.rotation) {
            rotation = model.rotation
            key += `_${rotation.toMapKey()}`
        }

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
            } else if (transparency == "cutoff") {
                if (texture.transparency == "transparent") transparency = "transparent"
            }

            uvValues.push(..._getUVs(texture, faceInfo, face, rotation, this.atlas))
        }

        if (vertexValues.length == 0) return null

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

        const primitive = this.document.createPrimitive()
            .setAttribute("POSITION", vertices)
            .setAttribute("TEXCOORD_0", uvs)
            .setIndices(indices)
            .setMaterial(transparency == "opaque" ? (
                this.atlas.getOpaqueMaterial()
            ) : transparency == "cutoff" ? (
                this.atlas.getCutoffMaterial()
            ) : transparency == "transparent" ? (
                this.atlas.getTransparentMaterial()
            ) : unreachable())

        compactPrimitive(primitive)

        const mesh = this.document.createMesh(key)
            .addPrimitive(primitive)

        this._meshCache.set(key, mesh)
        return mesh
    }

    protected _buildModel(model: BlockModel, faceMask: number, node: Node) {
        if (model.rotation) {
            let { x, y, z } = model.rotation

            if (z != 0) {
                warn(`Unsupported rotation in Z axis for model ${model.name}`)
            }

            if (y != 0) {
                while (y < 0) {
                    y += 360
                }

                while (y > 360) {
                    y -= 360
                }

                for (; y > 0; y -= 90) {
                    // FACE_NORTH
                    // FACE_EAST
                    // FACE_SOUTH
                    // FACE_WEST
                    faceMask = (faceMask & (FACE_UP | FACE_DOWN))
                        | ((faceMask & FACE_EAST) != 0 ? FACE_NORTH : 0)
                        | ((faceMask & FACE_SOUTH) != 0 ? FACE_EAST : 0)
                        | ((faceMask & FACE_WEST) != 0 ? FACE_SOUTH : 0)
                        | ((faceMask & FACE_NORTH) != 0 ? FACE_WEST : 0)
                }
            }

            if (x != 0) {
                while (x < 0) {
                    x += 360
                }

                while (x > 360) {
                    x -= 360
                }

                for (; x > 0; x -= 90) {
                    // FACE_NORTH
                    // FACE_UP
                    // FACE_SOUTH
                    // FACE_DOWN
                    faceMask = (faceMask & (FACE_EAST | FACE_WEST))
                        | ((faceMask & FACE_UP) != 0 ? FACE_SOUTH : 0)
                        | ((faceMask & FACE_SOUTH) != 0 ? FACE_DOWN : 0)
                        | ((faceMask & FACE_DOWN) != 0 ? FACE_NORTH : 0)
                        | ((faceMask & FACE_NORTH) != 0 ? FACE_UP : 0)
                }
            }
        }

        if (model.elements.length == 0) return

        for (let i = 0; i < model.elements.length; i++) {
            const child = this.document.createNode(`element_${i}`)
            model.elements[i].apply(child, model, faceMask, this.document, this)
            node.addChild(child)
        }

        if (model.rotationQuaternion) {
            node.setRotation(model.rotationQuaternion)
        }
    }

    protected _buildBlockState(pos: Vector3, state: BlockState, node: Node, context: Structure) {
        const info = this.modelProvider.getBlockRenderingInfo(state.block)
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

                const neighbour = context.getBlockState(neighbourPosition)
                if (neighbour == null) {
                    // This face neighbours the edge of the structure, we cull only if the user has configured it
                    if (this.cullEdges) faceMask ^= face
                    continue
                }

                const neighbourBlock = neighbour.block

                const neighbourInfo = this.modelProvider.getBlockRenderingInfo(neighbourBlock)
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

        if (info.isMultipart) {
            let j = 0

            for (const model of info.findModels(state)) {
                const partNode = this.document.createNode(`part_${j++}`)
                node.addChild(partNode)

                this._buildModel(model, faceMask, partNode)
            }
        } else {
            const model = info.findModel(state)

            if (model == null) {
                warn(`Failed to find matching model for block state ${state}`)
                return
            }

            this._buildModel(model, faceMask, node)
        }
    }

    constructor(
        public readonly document: Document,
        public readonly modelProvider: ModelProvider,
        public readonly atlas: TextureAtlas,
    ) { }
}
