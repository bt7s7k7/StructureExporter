import { FaceRotationAngle } from "../minecraft/assets"
import { TextureResource } from "../textures/TextureResource"


export class FaceInfo {
    constructor(
        public readonly texture: TextureResource | string,
        public readonly uv: readonly [number, number, number, number],
        public readonly rotation: FaceRotationAngle,
    ) { }

    protected static _fallback: FaceInfo | null = null
    public static getDefault() {
        return this._fallback ??= new FaceInfo(TextureResource.getFallback(), [0, 0, 16, 16], 0)
    }
}
