
export class BlockState {
    protected _properties: Map<string, string> | null = null

    public setProperty(key: string, value: string) {
        (this._properties ??= new Map()).set(key, value)
        return this
    }

    public addPropertiesFromString(properties: string) {
        if (properties == "") return this
        for (const property of properties.split(",")) {
            const [key, value] = property.split("=")
            this.setProperty(key, value)
        }
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

    public isSubsetOf(other: BlockState) {
        if (this._properties == null) return true
        if (other._properties == null) return false

        for (const [key, value] of this._properties) {
            if (other._properties.get(key) != value) return false
        }

        return true
    }

    constructor(
        public readonly block: string,
    ) { }
}
