import { parse, simplify } from "prismarine-nbt"
import { unreachable } from "../../comTypes/util"
import { NbtBlock, NbtCreateBlock, NbtStructure } from "../minecraft/structure"
import { PluginManager } from "../plugins/PluginManager"
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
    protected readonly _blocks = new Uint8Array(this.size.volume)
    protected readonly _palette: BlockState[] = [new BlockState("minecraft:structure_void")]
    protected readonly _paletteRefCounts: number[] = [this._blocks.length]
    protected readonly _paletteIndex = new Map<number, number>()

    public setBlockState(pos: Vector3, blockState: BlockState) {
        if (
            pos.x < 0 || pos.x >= this.size.x
            || pos.y < 0 || pos.y >= this.size.y
            || pos.z < 0 || pos.z >= this.size.z
        ) {
            throw new RangeError(`Position ${pos} is outside of structure size ${this.size}`)
        }

        const index = pos.x + pos.y * this.size.x + pos.z * this.size.x * this.size.y

        const prevId = this._blocks[index]
        const prevState = this._palette[prevId] ?? unreachable()

        if (prevState.uid == blockState.uid) return

        let paletteId = this._paletteIndex.get(blockState.uid)
        if (paletteId == null) {
            paletteId = this._palette.length
            this._palette.push(blockState)
            this._paletteRefCounts.push(0)
            this._paletteIndex.set(blockState.uid, paletteId)
        }

        this._paletteRefCounts[prevId]--
        this._paletteRefCounts[paletteId]++

        this._blocks[index] = paletteId
    }

    public getBlockState(pos: Vector3) {
        if (
            pos.x < 0 || pos.x >= this.size.x
            || pos.y < 0 || pos.y >= this.size.y
            || pos.z < 0 || pos.z >= this.size.z
        ) {
            return null
        }

        const index = pos.x + pos.y * this.size.x + pos.z * this.size.x * this.size.y

        return this._palette[this._blocks[index]]
    }

    public *getAssets(): Generator<BlockState> {
        for (let i = 0; i < this._paletteRefCounts.length; i++) {
            const count = this._paletteRefCounts[i]
            if (count > 0) yield this._palette[i]
        }

        for (const substructure of this.substructures) {
            yield* substructure.getAssets()
        }
    }

    public *getBlocks() {
        for (let z = 0; z < this.size.z; z++) {
            for (let y = 0; y < this.size.y; y++) {
                for (let x = 0; x < this.size.x; x++) {
                    const index = x + y * this.size.x + z * this.size.x * this.size.y
                    const id = this._blocks[index]
                    const state = this._palette[id]
                    yield [new Vector3(x, y, z), state] as const
                }
            }
        }
    }

    protected constructor(
        public readonly position: Vector3,
        public readonly rotation: Vector3,
        public readonly size: Vector3,
    ) { }

    public static fromNbt(plugins: PluginManager, data: NbtStructure, position = Vector3.ZERO, rotation = Vector3.ZERO) {
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

        const size = Vector3.fromArray(data.size)

        const structure = new Structure(position, rotation, size)

        for (const block of blocks) {
            const pos = Vector3.fromArray(block.pos)
            structure.setBlockState(pos, palette[block.state])
        }

        if (data.entities) {
            for (const entity of data.entities) {
                if (!entity.nbt.Contraption) continue
                let position = Vector3.fromArray(entity.pos)
                let rotation = Vector3.ZERO

                if (entity.nbt.Axis) {
                    rotation = rotation.with(entity.nbt.Axis.toLowerCase(), (entity.nbt.Angle ?? unreachable()) / 180 * Math.PI)
                }

                const substructure = Structure.fromNbt(plugins, entity.nbt.Contraption.Blocks, position, rotation)
                structure.substructures.push(substructure)
            }
        }

        if (data.sub_levels) {
            for (const sublevel of data.sub_levels) {
                let position = Vector3.fromObject(sublevel.position)
                let rotation = Vector3.fromObject(sublevel.orientation)

                const substructure = Structure.fromNbt(plugins, sublevel, position, rotation)
                structure.substructures.push(substructure)
            }
        }

        return plugins.executeHook("onLoadStructure", structure, data)
    }

    public static async load(plugins: PluginManager, buffer: ArrayBuffer) {
        using _ = new Stopwatch().start("Structure.load")
        const { parsed } = await parse(buffer)
        const data = simplify(parsed) as NbtStructure

        return this.fromNbt(plugins, data)
    }
}
