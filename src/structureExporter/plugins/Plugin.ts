import { Document, Scene } from "@gltf-transform/core"
import { Structure } from "../building/Structure"
import { Platform } from "../Platform"
import { BlockStateDefinition, Drawer, ModelDefinition, ModelProvider, NbtStructure, ResourceProvider, TextureResource } from "./pluginApi"

export interface PluginHooks {
    /** Executes for every structure loaded, that means the input structure and all substructures.
     * It is safe to modify the structure. Modifying the data has no effect. */
    onLoadStructure(structure: Structure, data: NbtStructure): Structure | void
    /** Executes before a block state definition, i.e. a file in `blockstates` folder, is loaded. Consequently the default value of `value` is `null`, but it might have been defined by a different plugin. If any hooks define the value, loading will not happen. */
    onBeforeLoadBlockStateDefinition(value: BlockStateDefinition | null, id: string): Promise<BlockStateDefinition | null>
    /** Executes after a block state definition, i.e. a file in `blockstates` folder, is loaded. You can replace or modify the value. */
    onLoadBlockStateDefinition(value: BlockStateDefinition, id: string): Promise<BlockStateDefinition | void>
    /** Executes before a model definition, i.e. a file in `models` folder, is loaded. Consequently the default value of `value` is `null`, but it might have been defined by a different plugin. If any hooks define the value, loading will not happen. */
    onBeforeLoadModelDefinition(value: ModelDefinition | null, id: string): Promise<ModelDefinition | null>
    /** Executes after a model definition, i.e. a file in `models` folder, is loaded. You can replace or modify the value. */
    onLoadModelDefinition(value: ModelDefinition, id: string): Promise<ModelDefinition | void>
    /** Executes before a texture, i.e. a file in `textures` folder, is loaded. Consequently the default value of `value` is `null`, but it might have been defined by a different plugin. If any hooks define the value, loading will not happen. */
    onBeforeLoadTexture(value: TextureResource | null, id: string): Promise<TextureResource | null>
    /** Executes after a texture, i.e. a file in `textures` folder, is loaded (see {@link onLoadTextureContent}) and its image data was already analysed for transparency. You can replace or modify the value. */
    onLoadTexture(value: TextureResource, id: string): Promise<TextureResource | void>
    /** Executes after the content of a texture is loaded and before it is analysed for transparency. Following this an actual texture resource object will be created, see {@link onLoadTexture}. */
    onLoadTextureContent(value: Drawer, id: string): Promise<Drawer | void>
}

export interface PluginEvents {
    /** Emitted before any processing happens */
    onInit(platform: Platform, input: string, output: string): Promise<void>
    /** Emitted before asset loading, but all container objects have been constructed. You can define custom assets and these will not be overwritten. */
    onBeforePrepareAssets(structure: Structure, resourceProvider: ResourceProvider, modelProvider: ModelProvider): Promise<void>
    /** Emitted after all assets have been loaded. You can modify the loaded assets. */
    onPrepareAssets(structure: Structure, resourceProvider: ResourceProvider, modelProvider: ModelProvider): Promise<void>
    /** Emitted after a 3D model has been built from structures, but before optimisation. */
    onBuild(document: Document, scene: Scene): Promise<void>
    /** Emitted before the 3D model is written to disk, but after optimisation. */
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
    onBeforePrepareAssets: null,
    onPrepareAssets: null,
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
