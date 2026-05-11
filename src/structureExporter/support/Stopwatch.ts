import { debug } from "./log"

export class Stopwatch {
    protected _start = 0
    protected _name: string | null = null

    public start(name: string) {
        this.end()
        this._start = performance.now()
        this._name = name
        return this
    }

    public end() {
        const end = performance.now()
        if (this._name == null) return
        Stopwatch._times.set(this._name, (Stopwatch._times.get(this._name) ?? 0) + (end - this._start))
        this._name = null
    }

    public [Symbol.dispose]() {
        this.end()
    }

    protected static readonly _times = new Map<string, number>()
    public static dump() {
        debug(`[Performance] ${[...this._times].map(([key, value]) => `${key}: ${value.toFixed(2)}ms`).join("; ")}`)
    }
}
