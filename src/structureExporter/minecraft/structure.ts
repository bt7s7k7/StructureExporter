export interface NbtStructure {
    size: [number, number, number]
    blocks: NbtBlock[] | NbtCreateBlock[]
    palette: NbtPaletteEntry[]
    entities?: NbtEntity[]
    sub_levels?: (NbtStructure & { position: { x: number, y: number, z: number }, orientation: { x: number, y: number, z: number } })[]
    DataVersion: number
}

export interface NbtBlock {
    state: number
    pos: [number, number, number]
    nbt?: {
        id: string
        [index: string]: any
    }
}

export interface NbtCreateBlock {
    Pos: [number, number]
    State: number
    Nbt?: NbtBlock["nbt"]
}

export interface NbtPaletteEntry {
    Name: string
    Properties?: NbtPaletteProperties
}

export interface NbtPaletteProperties {
    [property: string]: string
}

export interface NbtEntity {
    blockPos: [number, number, number]
    nbt: {
        UUID: [number, number, number, number]
        id: string
        Rotation: [number, number, number]
        Pos: [number, number, number]
        [index: string]: any
    }
    pos: [number, number, number]
}
