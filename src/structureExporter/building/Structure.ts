import { parse, simplify } from "prismarine-nbt"
import { unreachable } from "../../comTypes/util"
import { NbtBlock, NbtCreateBlock, NbtStructure } from "../minecraft/structure"
import { Stopwatch } from "../support/Stopwatch"
import { Vector3 } from "../support/Vector3"
import { BlockState } from "./BlockState"

// Reversed engineered from Minecraft, see BlockPos
function _smallestEncompassingPowerOfTwo(value: number) {
    let i = value - 1
    i |= i >> 1
    i |= i >> 2
    i |= i >> 4
    i |= i >> 8
    i |= i >> 16
    return i + 1
}

const PACKED_X_LENGTH = BigInt(1 + Math.log2(_smallestEncompassingPowerOfTwo(30000000)))
const PACKED_Z_LENGTH = PACKED_X_LENGTH
const PACKED_Y_LENGTH = 64n - PACKED_X_LENGTH - PACKED_Z_LENGTH
const Y_OFFSET = 0n
const Z_OFFSET = PACKED_Y_LENGTH
const X_OFFSET = PACKED_Y_LENGTH + PACKED_Z_LENGTH

export class Structure {
    public readonly substructures: Structure[] = []

    protected readonly _blockLookup = new Map<string, NbtBlock>()

    public getBlock(pos: Vector3) {
        return this._blockLookup.get(pos.toMapKey())
    }

    public *getAssets(): Generator<BlockState> {
        yield* this.palette

        for (const substructure of this.substructures) {
            yield* substructure.getAssets()
        }
    }

    protected constructor(
        public readonly position: Vector3,
        public readonly rotation: Vector3,
        public readonly palette: BlockState[],
        public readonly blocks: NbtBlock[],
    ) { }

    public static fromNbt(data: NbtStructure, position = Vector3.ZERO, rotation = Vector3.ZERO) {
        // Create contraption format compatibility
        if (!("palette" in data) && "Palette" in data) {
            // @ts-ignore
            data.palette = data.Palette
        }

        if (!("blocks" in data) && "BlockList" in data) {
            // @ts-ignore
            data.blocks = data.BlockList
        }

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

        let blocks = data.blocks
        if (blocks.length > 0 && "Pos" in blocks[0]) {
            const transformedBlocks: NbtBlock[] = []

            for (const block of blocks as NbtCreateBlock[]) {
                const [posHigh, posLow] = block.Pos
                const packed = BigInt(posHigh) << 32n | BigInt(posLow) & 0xffffffffn

                // Reversed engineered from Minecraft, see BlockPos.of(long) and .getX, .getY and .getZ
                const x = Number(BigInt.asIntN(64, BigInt.asIntN(64, packed << 64n - X_OFFSET - PACKED_X_LENGTH) >> 64n - PACKED_X_LENGTH))
                const z = Number(BigInt.asIntN(64, BigInt.asIntN(64, packed << 64n - Z_OFFSET - PACKED_Z_LENGTH) >> 64n - PACKED_Z_LENGTH))
                const y = Number(BigInt.asIntN(64, BigInt.asIntN(64, packed << 64n - Y_OFFSET - PACKED_Y_LENGTH) >> 64n - PACKED_Y_LENGTH))

                transformedBlocks.push({
                    state: block.State,
                    nbt: block.Nbt,
                    pos: [x, y, z],
                })
            }

            blocks = transformedBlocks
        } else {
            blocks = blocks as NbtBlock[]
        }

        const structure = new Structure(position, rotation, palette, blocks)

        for (const block of blocks) {
            const pos = Vector3.fromArray(block.pos)
            structure._blockLookup.set(pos.toMapKey(), block)
        }

        if (data.entities) {
            for (const entity of data.entities) {
                if (!entity.nbt.Contraption) continue
                let position = Vector3.fromArray(entity.pos)
                let rotation = Vector3.ZERO

                if (entity.nbt.Axis) {
                    rotation = rotation.with(entity.nbt.Axis.toLowerCase(), (entity.nbt.Angle ?? unreachable()) / 180 * Math.PI)
                }

                const substructure = Structure.fromNbt(entity.nbt.Contraption.Blocks, position, rotation)
                structure.substructures.push(substructure)
            }
        }

        if (data.sub_levels) {
            for (const sublevel of data.sub_levels) {
                let position = Vector3.fromObject(sublevel.position)
                let rotation = Vector3.fromObject(sublevel.orientation)

                const substructure = Structure.fromNbt(sublevel, position, rotation)
                structure.substructures.push(substructure)
            }
        }

        return structure
    }

    public static async load(buffer: Buffer | ArrayBuffer) {
        using _ = new Stopwatch().start("Structure.load")
        const { parsed } = await parse(buffer)
        const data = simplify(parsed) as NbtStructure

        return this.fromNbt(data)
    }
}
