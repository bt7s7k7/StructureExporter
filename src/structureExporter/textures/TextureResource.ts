import { Drawer } from "../../drawer/Drawer"
import { Point } from "../../drawer/Point"

export class TextureResource {
    public x = 0
    public y = 0

    constructor(
        public readonly width: number,
        public readonly height: number,
        public readonly transparency: "opaque" | "transparent" | "cutoff",
        public readonly image: Drawer,
    ) { }

    protected static _fallback: TextureResource | null = null
    public static getFallback() {
        return this._fallback ??= new TextureResource(16, 16, "opaque", Drawer.makeTestPattern("missing-texture", new Point(16, 16)))
    }
}
