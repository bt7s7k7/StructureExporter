import { ShiftTuple } from "../../comTypes/types"
import { Platform } from "../Platform"
import { declarePlugin, Plugin, PluginEvents, PluginHooks, PluginOptions } from "./Plugin"

export class PluginManager {
    public readonly plugins: Plugin[] = []

    public async loadPlugin(path: string) {
        try {
            const data = (await this.platform.loadPlugin(path)) as PluginOptions
            this.plugins.push(declarePlugin(data))
        } catch (err) {
            throw new Error(`Failed to load plugin "${path}"`, { cause: err })
        }
    }

    public executeHook<K extends keyof PluginHooks>(name: K, target: Parameters<PluginHooks[K]>[0], ...args: ShiftTuple<Parameters<PluginHooks[K]>>) {
        for (const plugin of this.plugins) {
            // @ts-ignore
            const result = plugin[name]?.(target, ...args)
            if (result instanceof Promise) throw new TypeError(`Hook of ${plugin.name}:${name} returned a promise`)
            if (result != null) target = result
        }

        return target
    }

    public async executeHookAsync<K extends keyof PluginHooks>(name: K, target: Parameters<PluginHooks[K]>[0], ...args: ShiftTuple<Parameters<PluginHooks[K]>>) {
        for (const plugin of this.plugins) {
            // @ts-ignore
            const result = await plugin[name]?.(target, ...args)
            if (result != null) target = result
        }

        return target
    }

    public executeHandler<K extends keyof PluginEvents>(name: K, ...args: Parameters<PluginEvents[K]>) {
        for (const plugin of this.plugins) {
            // @ts-ignore
            const result = plugin[name]?.(...args)
            if (result instanceof Promise) throw new TypeError(`Hook of ${plugin.name}:${name} returned a promise`)
        }
    }

    public async executeHandlerAsync<K extends keyof PluginEvents>(name: K, ...args: Parameters<PluginEvents[K]>) {
        for (const plugin of this.plugins) {
            // @ts-ignore
            await plugin[name]?.(...args)
        }
    }

    constructor(
        public readonly platform: Platform,
    ) { }
}
