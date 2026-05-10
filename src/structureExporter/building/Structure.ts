import { parse, simplify } from "prismarine-nbt"
import { NbtBlock, NbtStructure } from "../minecraft/structure"
import { Vector3 } from "../support/Vector3"
import { BlockState } from "./BlockState"

export class Structure {
    protected readonly _blockLookup = new Map<string, NbtBlock>()

    public getBlock(pos: Vector3) {
        return this._blockLookup.get(pos.toMapKey())
    }

    protected constructor(
        public readonly size: Vector3,
        public readonly palette: BlockState[],
        public readonly blocks: NbtBlock[],
    ) { }

    public static async load(buffer: Buffer) {
        const { parsed } = await parse(buffer)
        const data = simplify(parsed) as NbtStructure
        const size = Vector3.fromArray(data.size)

        const palette: BlockState[] = []

        for (const entry of data.palette) {
            const state = new BlockState(entry.Name)
            if (entry.Properties) {
                for (const [property, value] of Object.entries(entry.Properties)) {
                    state.setProperty(property, value)
                }
            }

            palette.push(state)
        }

        const structure = new Structure(size, palette, data.blocks)

        for (const block of data.blocks) {
            const pos = Vector3.fromArray(block.pos)
            structure._blockLookup.set(pos.toMapKey(), block)
        }

        return structure
    }
}
