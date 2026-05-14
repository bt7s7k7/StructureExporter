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
        Stopwatch._counters.set(this._name, (Stopwatch._counters.get(this._name) ?? 0) + 1)
        this._name = null
    }

    public [Symbol.dispose]() {
        this.end()
    }

    protected static readonly _times = new Map<string, number>()
    protected static readonly _counters = new Map<string, number>()
    public static dump() {
        debug(`[Performance] ${[...this._times].map(([key, value]) => {
            const count = this._counters.get(key)!
            return `${key}${count <= 1 ? "" : `*${count}`}: ${value.toFixed(2)}ms`
        }).join("; ")}`)
    }

    public static clear() {
        this._times.clear()
        this._counters.clear()
    }
}
