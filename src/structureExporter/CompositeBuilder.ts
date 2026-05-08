import { Document, Node, Scene } from "@gltf-transform/core"
import { ModelManager } from "./ModelManager"
import { Structure } from "./Structure"
import { Vector3 } from "./Vector3"

export class CompositeBuilder {
    public addStructure(structure: Structure) {
        for (const block of structure.blocks) {
            const pos = Vector3.fromArray(block.pos)
            const state = structure.palette[block.state]
            const node = this.document.createNode(`(${pos.toMapKey()})${state.toString()}`)
                .setMesh(this.modelManager.getMeshFor(state))
                .setTranslation(pos.toArray())

            this.root.addChild(node)
        }
    }

    constructor(
        public readonly document: Document,
        public readonly modelManager: ModelManager,
        public readonly root: Node | Scene,
    ) { }
}
