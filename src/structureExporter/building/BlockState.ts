const _ids = new Map<string, number>()

export class BlockState {
    protected _id = -1
    protected _properties: Map<string, string> | null = null

    public setProperty(key: string, value: string) {
        (this._properties ??= new Map()).set(key, value)
        this._id = -1
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

    public get uid() {
        if (this._id != -1) return this._id

        const key = this.toString()

        let id = _ids.get(key)

        if (id == null) {
            id = _ids.size
            _ids.set(key, id)
        }

        return this._id = id
    }

    constructor(
        public readonly block: string,
    ) { }
}
