import { Document, Node, vec3, vec4 } from "@gltf-transform/core"
import { BlockBuilder } from "../building/BlockBuilder"
import { FACES } from "../support/FACES"
import { Vector3 } from "../support/Vector3"
import { BlockModel } from "./BlockModel"
import { FaceInfo } from "./FaceInfo"


export abstract class BlockModelElement {
    public abstract apply(node: Node, model: BlockModel, faceMask: number, document: Document, builder: BlockBuilder): void
    public abstract getFaces(): Generator<FaceInfo>
}

export class CubicElement extends BlockModelElement {
    protected _faceMask = 0
    protected _faceInfo = Array.from<FaceInfo | null>({ length: 6 }).fill(null)

    public setFaceInfo(face: number, info: FaceInfo) {
        const index = 31 - Math.clz32(face)
        this._faceInfo[index] = info
        this._faceMask |= face
    }

    public getFaceInfo(face: number) {
        const index = 31 - Math.clz32(face)
        return this._faceInfo[index]
    }

    public override apply(node: Node, model: BlockModel, faceMask: number, document: Document, builder: BlockBuilder): void {
        node
            .setMesh(builder.buildElementMesh(model, this.idx, this._faceMask & faceMask, this._faceInfo))
            .setTranslation(this.translation)
            .setScale(this.scale)
    }

    public override *getFaces() {
        for (const face of FACES) {
            const info = this.getFaceInfo(face)!
            if (info == null) continue
            yield info
        }
    }

    constructor(
        public idx: number,
        public translation: vec3,
        public scale: vec3,
    ) { super() }

    public static getFallback() {
        const element = new CubicElement(0, Vector3.ZERO.toArray(), Vector3.ONE.toArray())

        for (const face of FACES) {
            element.setFaceInfo(face, FaceInfo.getDefault())
        }

        return element
    }
}

export class RotationModelElementDecorator extends BlockModelElement {
    public override apply(node: Node, model: BlockModel, faceMask: number, document: Document, builder: BlockBuilder): void {
        const child = document.createNode("base")
        this.base.apply(child, model, faceMask, document, builder)

        node
            .addChild(child)
            .setTranslation(this.translation)
            .setRotation(this.rotation)
    }

    public override getFaces() {
        return this.base.getFaces()
    }

    constructor(
        public base: BlockModelElement,
        public translation: vec3,
        public rotation: vec4,
    ) { super() }
}
