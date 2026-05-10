import { Face } from "./minecraft/assets"
import { TextureResource } from "./TextureResource"


export class FaceInfo {
    constructor(
        public readonly texture: TextureResource | string,
        public readonly uv: readonly [number, number, number, number],
        public readonly rotation: NonNullable<Face["rotation"]>,
    ) { }

    protected static _fallback: FaceInfo | null = null
    public static getDefault() {
        return this._fallback ??= new FaceInfo(TextureResource.getFallback(), [0, 0, 16, 16], 0)
    }
}
