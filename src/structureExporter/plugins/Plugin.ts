import { Document, Scene } from "@gltf-transform/core"
import { Structure } from "../building/Structure"
import { Platform } from "../Platform"
import { BlockStateDefinition, Drawer, ModelDefinition, ModelProvider, NbtStructure, ResourceProvider, TextureResource } from "./pluginApi"

export interface PluginHooks {
    onLoadStructure(structure: Structure, data: NbtStructure): Structure | void
    onBeforeLoadBlockStateDefinition(value: BlockStateDefinition | null, id: string): Promise<BlockStateDefinition | null>
    onLoadBlockStateDefinition(value: BlockStateDefinition, id: string): Promise<BlockStateDefinition | void>
    onBeforeLoadModelDefinition(value: ModelDefinition | null, id: string): Promise<ModelDefinition | null>
    onLoadModelDefinition(value: ModelDefinition, id: string): Promise<ModelDefinition | void>
    onBeforeLoadTexture(value: TextureResource | null, id: string): Promise<TextureResource | null>
    onLoadTexture(value: TextureResource, id: string): Promise<TextureResource | void>
    onLoadTextureContent(value: Drawer, id: string): Promise<Drawer | void>
}

export interface PluginEvents {
    onInit(platform: Platform, input: string, output: string): Promise<void>
    onReady(structure: Structure, resourceProvider: ResourceProvider, modelProvider: ModelProvider): Promise<void>
    onBuild(document: Document, scene: Scene): Promise<void>
    onBeforeWrite(document: Document, scene: Scene): Promise<void>
}

export interface PluginOptions extends Partial<PluginHooks>, Partial<PluginEvents> {
    name: string
}

type _Resolve<T> = {
    [P in keyof T]-?: P extends "name" ? T[P] : T[P] | null
}

const _RESOLVED = Symbol.for("structureExporter.pluginResolved")
export type Plugin = _Resolve<PluginOptions> & { [_RESOLVED]: true }

const _NOOP_PLUGIN: Plugin = {
    name: "noop",
    onLoadStructure: null,
    onReady: null,
    onInit: null,
    onBeforeLoadBlockStateDefinition: null,
    onBeforeLoadModelDefinition: null,
    onBeforeLoadTexture: null,
    onLoadBlockStateDefinition: null,
    onLoadModelDefinition: null,
    onLoadTexture: null,
    onLoadTextureContent: null,
    onBuild: null,
    onBeforeWrite: null,
    [_RESOLVED]: true,
}

export function declarePlugin(plugin: PluginOptions): Plugin {
    if (plugin == null || typeof plugin != "object") throw new TypeError("Expected object")

    if (_RESOLVED in plugin) return plugin as any

    const resolvedPlugin: any = Object.assign({}, _NOOP_PLUGIN)
    resolvedPlugin[_RESOLVED] = true

    for (const [key, template] of Object.entries(resolvedPlugin)) {
        const value = (plugin as any)[key]

        if (template == null) {
            if (value == null) continue
            if (typeof value != "function") throw new TypeError(`Expected "${key}" to be a function`)
        } else if (typeof template == "string") {
            if (typeof value != "string") throw new TypeError(`Expected string property "${key}"`)
        }

        resolvedPlugin[key] = value
    }

    return resolvedPlugin
}
