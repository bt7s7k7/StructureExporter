import { unreachable } from "../../comTypes/util"

export function memoizeMethods(owner: any, methods: string[]) {
    for (const key of methods) {
        const method = (owner[key] ?? unreachable()).bind(owner)
        const cache = new Map<string, Promise<any>>()

        owner[key] = function (id: string) {
            if (cache.has(id)) return cache.get(id)!
            const promise = method(id)
            cache.set(id, promise)
            return promise
        }
    }
}
