import { join, resolve } from "node:path"
import { insertSorted } from "../../comTypes/util"
import { Platform } from "../Platform"
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
            await this.platform.rm(path)
            this.packs.splice(existing, 1)
        }

        await this.platform.mkdir(path)
        const pack = new ResourcePack(this.platform, name, path)
        insertSorted(pack, this.packs, _COMPARATOR)
        return pack
    }

    protected constructor(
        public readonly platform: Platform,
        public readonly root: string,
        public readonly packs: ResourcePack[],
    ) { }

    public static async createOrOpen(platform: Platform, path: string | null | undefined) {
        path ??= resolve("resources")
        await platform.mkdir(path)

        const packs: ResourcePack[] = []

        for await (const dirent of platform.readdir(path)) {
            if (!dirent.isDirectory()) continue
            packs.push(new ResourcePack(platform, dirent.name, join(path, dirent.name)))
        }

        packs.sort(_COMPARATOR)

        return new ResourcePackManager(platform, path, packs)
    }
}
