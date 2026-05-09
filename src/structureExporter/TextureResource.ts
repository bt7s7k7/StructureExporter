import sharp, { Sharp } from "sharp"


export class TextureResource {
    public x = 0
    public y = 0

    constructor(
        public readonly width: number,
        public readonly height: number,
        public readonly image: Sharp,
    ) { }

    protected static _fallback: TextureResource | null = null
    public static getFallback() {
        return this._fallback ??= new TextureResource(16, 16, sharp(Buffer.from("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVR4AeySsQ0AQAgC791/Z54FpLGxMIqN0QRyJaQkQEnl5ajvASzI4JHLjBiEfi6wMMLQx2cBPgAAAP//7Arj4gAAAAZJREFUAwA1ZDABlggGZAAAAABJRU5ErkJggg==", "base64url")))
    }
}
