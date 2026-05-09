import { Document, Node, Scene } from "@gltf-transform/core"
import { BlockBuilder } from "./BlockBuilder"
import { Structure } from "./Structure"
import { Vector3 } from "./Vector3"

export class CompositeBuilder {
    public addStructure(structure: Structure) {
        for (const block of structure.blocks) {
            const pos = Vector3.fromArray(block.pos)
            const state = structure.palette[block.state]
            const node = this.document.createNode(`(${pos.toMapKey()})${state.toString()}`)
                .setTranslation(pos.toArray())

            this.blockBuilder.buildBlockState(state, node)

            this.root.addChild(node)
        }
    }

    constructor(
        public readonly document: Document,
        public readonly blockBuilder: BlockBuilder,
        public readonly root: Node | Scene,
    ) { }
}
