export interface BlockStateDefinition {
    variants?: Record<string, BlockStateModelReference | BlockStateModelReference[]>
    multipart?: BlockStatePart[]
}

export type BlockStatePartCondition =
    | { "AND": Record<string, string>[] }
    | { "OR": Record<string, string>[] }
    | Record<string, string>

export interface BlockStatePart {
    when?: BlockStatePartCondition
    apply: BlockStateModelReference | BlockStateModelReference[]
}

export interface BlockStateModelReference {
    model: string
    x?: number
    y?: number
    z?: number
    uvlock?: boolean
}

export interface ModelDefinition {
    textures?: Record<string, string>
    elements?: ModelElement[]
    parent?: string
}


export interface ModelElement {
    from: [number, number, number]
    to: [number, number, number]
    faces: Partial<Record<"down" | "up" | "north" | "south" | "west" | "east", Face>>
    rotation?:
    | { origin: [number, number, number], axis: "x" | "y" | "z", angle: number }
    | { origin: [number, number, number], x: number, y: number, z: number }
}

export interface Face {
    uv?: [number, number, number, number]
    texture: string
    cullface?: "down" | "up" | "north" | "south" | "west" | "east"
    rotation?: 0 | 90 | 180 | 270
}
