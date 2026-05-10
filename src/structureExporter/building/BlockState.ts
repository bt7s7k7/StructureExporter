export class BlockState {
    protected _properties: Map<string, string> | null = null

    public setProperty(key: string, value: string) {
        (this._properties ??= new Map()).set(key, value)
        return this
    }

    public toString() {
        return `${this.block}${this._properties == null ? "" : `[${this.getBlockStateKey()}]`}`
    }

    public getBlockStateKey() {
        if (this._properties == null) return ""
        return [...this._properties].map(([key, value]) => `${key}=${value}`).join(",")
    }

    public [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString()
    }

    constructor(
        public readonly block: string,
    ) { }
}
