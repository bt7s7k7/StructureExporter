import { Document, Mesh } from "@gltf-transform/core"
import { BlockState } from "./BlockState"

export class ModelManager {
    protected _FALLBACK: Mesh | null = null

    protected _getFallback() {
        if (this._FALLBACK != null) return this._FALLBACK

        const buffer = this.document.createBuffer()

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
            .setBuffer(buffer)

        const indices = this.document.createAccessor()
            .setArray(new Uint16Array([
                // Front
                0, 1, 2, 1, 3, 2,
                // Back
                5, 4, 7, 4, 6, 7,
                // Left
                4, 0, 6, 0, 2, 6,
                // Right
                1, 5, 3, 5, 7, 3,
                // Top
                2, 3, 6, 3, 7, 6,
                // Bottom
                4, 5, 0, 5, 1, 0,
            ]))
            .setBuffer(buffer)

        const prim = this.document.createPrimitive()
            .setAttribute("POSITION", vertices)
            .setIndices(indices)

        return this._FALLBACK = this.document.createMesh().addPrimitive(prim)
    }

    public getMeshFor(state: BlockState) {
        return this._getFallback()
    }

    constructor(
        public readonly document: Document,
    ) { }
}
