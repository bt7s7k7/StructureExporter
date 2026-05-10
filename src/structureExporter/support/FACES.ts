/** -Y */ export const FACE_DOWN = 1 << 0
/** +Y */ export const FACE_UP = 1 << 1
/** -Z */ export const FACE_NORTH = 1 << 2
/** +Z */ export const FACE_SOUTH = 1 << 3
/** -X */ export const FACE_WEST = 1 << 4
/** +X */ export const FACE_EAST = 1 << 5

export const FACE_ALL = FACE_DOWN | FACE_UP | FACE_NORTH | FACE_SOUTH | FACE_WEST | FACE_EAST

export const FACES = [
    FACE_DOWN,
    FACE_UP,
    FACE_NORTH,
    FACE_SOUTH,
    FACE_WEST,
    FACE_EAST,
] as const
