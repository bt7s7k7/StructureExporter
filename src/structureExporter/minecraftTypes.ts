export interface NbtStructure {
    size: [number, number, number]
    blocks: NbtBlock[]
    palette: NbtPaletteEntry[]
    entities: NbtEntity[]
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
