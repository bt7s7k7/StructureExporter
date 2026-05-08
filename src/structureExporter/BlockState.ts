import { binarySearch } from "../comTypes/util"

export class BlockState {
    protected _keys: string[] | null = null
    protected _values: string[] | null = null

    public setProperty(key: string, value: string) {
        this._keys ??= []
        this._values ??= []
        const index = binarySearch(this._keys, v => key.localeCompare(v, "en"))

        if (index < 0) {
            this._keys.splice(-index - 1, 0, key)
            this._values.splice(-index - 1, 0, value)
        } else {
            this._values[index] = value
        }

        return this
    }

    public toString() {
        return `${this.block}${this._keys == null ? "" : `[${this.getBlockStateKey()}]`}`
    }

    public getBlockStateKey() {
        if (this._keys == null) return ""
        return this._keys.map((v, i) => `${v}=${this._values![i]}`).join(",")
    }

    public [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString()
    }

    constructor(
        public readonly block: string,
    ) { }
}
