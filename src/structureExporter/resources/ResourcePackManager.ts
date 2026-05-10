import { mkdir, readdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { insertSorted } from "../../comTypes/util"
import { ResourcePack } from "./ResourcePack"

const _COMPARATOR = (a: ResourcePack, b: ResourcePack) => a.name.localeCompare(b.name, "en")

export class ResourcePackManager {
    public async loadResource(path: string) {
        for (const pack of this.packs) {
            const resource = await pack.loadResource(path)
            if (resource) return resource
        }

        return null
    }

    public async getOrCreatePack(name: string) {
        const existing = this.packs.find(v => v.name == name)
        if (existing) return existing

        return await this.createOrOverwritePack(name)
    }

    public async createOrOverwritePack(name: string) {
        const path = join(this.root, name)

        const existing = this.packs.findIndex(v => v.name == name)
        if (existing != -1) {
            await rm(path, { force: true, recursive: true })
            this.packs.splice(existing, 1)
        }

        await mkdir(path)
        const pack = new ResourcePack(name, path)
        insertSorted(pack, this.packs, _COMPARATOR)
        return pack
    }

    protected constructor(
        public readonly root: string,
        public readonly packs: ResourcePack[],
    ) { }

    public static async createOrOpen(path: string | null | undefined) {
        path ??= resolve("resources")
        await mkdir(path, { recursive: true })

        const packs: ResourcePack[] = []

        for (const dirent of await readdir(path, { withFileTypes: true })) {
            if (!dirent.isDirectory()) continue
            packs.push(new ResourcePack(dirent.name, join(path, dirent.name)))
        }

        packs.sort(_COMPARATOR)

        return new ResourcePackManager(path, packs)
    }
}
