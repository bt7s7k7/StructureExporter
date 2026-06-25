import { basename, dirname, join } from "node:path"
import { InjectionKey } from "vue"
import { fromBase64Binary } from "../comTypes/util"
import { Drawer } from "../drawer/Drawer"
import { Platform } from "../structureExporter/Platform"
import { Plugin, PluginOptions } from "../structureExporter/plugins/Plugin"
import { LOGGER } from "../structureExporter/support/log"
import { Variant } from "../vue3gui/variants"

export class BrowserPlatform extends Platform {
    public readonly logElement = document.createElement("div")

    public log(msgs: any[], style: Variant | "muted" | null) {
        const element = document.createElement("div")

        const text = msgs.join(" ")
        element.append(document.createTextNode(text))

        element.classList.add("monospace")
        element.classList.add("pre-wrap")
        element.classList.add("bg-dark")
        element.classList.add("rounded")
        element.classList.add("p-1")

        if (style != null) {
            if (style == "muted") element.innerHTML = `<span class="muted">${element.innerHTML}</span>`
            else element.classList.add("text-" + style)
        }

        this.logElement.appendChild(element)
    }

    public clearLog() {
        this.logElement.innerHTML = ""
    }

    protected _pathCache = new Map<string, FileSystemDirectoryHandle>()
    protected _mappings = new Map<string, string>()
    protected _reverseMappings = new Map<string, string>()

    public async invalidateCache() {
        this._pathCache.clear()
        this._mappings.clear()
        this._reverseMappings.clear()
        const mappings = await this.getMappings()
        for (const [from, to] of Object.entries(mappings)) {
            this._pathCache.set(from, await this._getDirectory(to))
            this._mappings.set(from, to)
            this._reverseMappings.set(to, from)
        }
    }

    public async getMappings() {
        const file = await (await this.root).getFileHandle("mappings.json", { create: true })
        const content = await (await file.getFile()).text()
        const mappings: Record<string, string> = content ? JSON.parse(content) : {}
        return mappings
    }

    public async setMapping(from: string, to: string | null) {
        const mappings = await this.getMappings()
        if (to == null) {
            delete mappings[from]
            this._pathCache.delete(from)
        } else {
            mappings[from] = to
            this._pathCache.set(from, await this._getDirectory(to, { create: true }))
            this._mappings.set(from, to)
            this._reverseMappings.set(to, from)
        }
        const file = await (await this.root).getFileHandle("mappings.json", { create: true })
        const writer = await file.createWritable()
        await writer.write(JSON.stringify(mappings))
        await writer.close()
    }

    protected async _getDirectory(path: string, options?: FileSystemGetDirectoryOptions) {
        if (path.startsWith("/")) path = path.slice(1)
        if (path == "" || path == ".") return this.root

        const cached = this._pathCache.get(path)
        if (cached) return cached

        try {
            const name = basename(path)
            const dir = dirname(path)

            let target = await this.root
            if (dir && dir != ".") {
                target = await this._getDirectory(dir, options)
            }

            target = await target.getDirectoryHandle(name, options)
            this._pathCache.set(path, target)
            return target
        } catch (err: any) {
            if (err.name == "NotFoundError") {
                const error = new Error("Cannot resolve path " + path)
                // @ts-ignore
                error.code = "ENOENT"
                throw error
            }

            throw err
        }
    }

    public override async mkdir(path: string): Promise<void> {
        await this._getDirectory(path, { create: true })
    }

    public override async * readdir(path: string): AsyncGenerator<{ isDirectory(): boolean, name: string }> {
        if (path.startsWith("/")) path = path.slice(1)
        const directory = await this._getDirectory(path)

        // @ts-ignore
        for await (const [key, value] of directory.entries()) {
            const fullPath = join(path, key)

            const mapped = this._reverseMappings.get(fullPath)
            if (mapped) {
                yield { name: basename(mapped), isDirectory() { return value.kind == "directory" } }
                continue
            }

            yield { name: key, isDirectory() { return value.kind == "directory" } }
        }
    }

    public override async rm(path: string): Promise<void> {
        if (path.startsWith("/")) path = path.slice(1)

        const mapped = this._mappings.get(path)
        if (mapped) {
            await this.rm(mapped)
            await this.setMapping(path, null)
            return
        }

        const directory = await this._getDirectory(dirname(path))
        await directory.removeEntry(basename(path), { recursive: true })
    }

    public override async read(path: string): Promise<Uint8Array> {
        try {
            const directory = await this._getDirectory(dirname(path))
            const fileHandle = await directory.getFileHandle(basename(path))
            const file = await fileHandle.getFile()
            return await file.bytes()
        } catch (err: any) {
            if (err.name == "NotFoundError") {
                const error = new Error("Cannot read file " + path)
                // @ts-ignore
                error.code = "ENOENT"
                throw error
            }
            throw err
        }
    }

    public override async write(path: string, content: string | Uint8Array): Promise<void> {
        const directory = await this._getDirectory(dirname(path))
        const fileHandle = await directory.getFileHandle(basename(path), { create: true })
        const file = await fileHandle.createWritable()
        await file.write(typeof content == "string" ? content : content.buffer as ArrayBuffer)
        await file.close()
    }

    public override async loadImage(data: Uint8Array): Promise<Drawer.ImageSource & { width: number, height: number }> {
        const blob = new Blob([data.buffer as ArrayBuffer])
        using disposer = new DisposableStack()
        const url = disposer.adopt(URL.createObjectURL(blob), v => URL.revokeObjectURL(v))

        const image = new Image()

        const promise = new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => {
                resolve()
            })

            image.addEventListener("error", (error) => {
                reject(error.error)
            })
        })

        image.src = url

        await promise

        return image
    }

    public override async saveImage(image: Drawer): Promise<Uint8Array> {
        const dataUrl = image.ctx.canvas.toDataURL("image/png")
        return fromBase64Binary(dataUrl.slice("data:image/png;base64,".length))
    }

    public override async loadPlugin(path: string): Promise<() => (Plugin | PluginOptions)> {
        throw new Error("Plugins are not supported in this environment")
    }

    protected constructor(
        public readonly root: Promise<FileSystemDirectoryHandle>,
    ) {
        super()

        this.logElement.classList.add("as-dark-theme")
        this.logElement.classList.add("flex")
        this.logElement.classList.add("column")
        this.logElement.classList.add("start-cross")
    }

    public static create() {
        const platform = new BrowserPlatform(navigator.storage.getDirectory())

        LOGGER.print = (...msg) => platform.log(msg, null)
        LOGGER.debug = (...msg) => platform.log(msg, "muted")
        LOGGER.info = (...msg) => platform.log(msg, "primary")
        LOGGER.warn = (...msg) => platform.log(msg, "warning")
        LOGGER.error = (...msg) => platform.log(msg, "danger")

        Object.assign(window, { LOGGER, PLATFORM: platform })

        return platform
    }
}

export const BROWSER_PLATFORM = Symbol.for("structureExporter.browserPlatform") as InjectionKey<BrowserPlatform>
