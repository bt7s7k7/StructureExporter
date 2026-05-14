import { unzipSync } from "fflate"
import { dirname, join, relative } from "node:path"
import { asyncConcurrency } from "../../comTypes/util"
import { Platform } from "../Platform"
import { print } from "../support/log"
import { Stopwatch } from "../support/Stopwatch"

export class ResourcePack {
    public async importSource(source: string | Uint8Array | Buffer) {
        if (typeof source == "string") {
            source = await this.platform.read(source)
        }

        const zip = unzipSync(source, {
            filter: (file) => {
                // Only get files from relevant directories, that is blockstates and block models and
                // textures. The "custom" directory is included for compatibility with
                // DecorativeBlocks-Reborn, which breaks the folder structure standard.
                return !file.name.endsWith("/") && !!file.name.match(/^assets\/\w+\/(textures\/(?:block|custom)|blockstates|models\/(?:block|custom))\//)
            },
        })

        const existingPaths = new Set<string>()
        const queue = asyncConcurrency<any>(100)

        let pending = 0
        let done = 0

        for (const [name, content] of Object.entries(zip)) {
            const targetPath = join(this.path, name)
            const targetDirname = dirname(targetPath)

            if (!existingPaths.has(targetDirname)) {
                await this.platform.mkdir(targetDirname)
                print(`Extracting: ${relative(this.path, targetDirname)}`)
                existingPaths.add(targetDirname)
            }

            pending++
            queue.push(() => this.platform.write(targetPath, content).then(() => done++))
        }

        const interval = setInterval(() => {
            if (pending == 0) return
            print(`Progress: ${done}/${pending}`)
        }, 500)

        try {
            await queue.join()
        } finally {
            clearInterval(interval)
        }
    }

    public async loadResource(path: string) {
        using stopwatch = new Stopwatch().start("loadResource")
        const fullPath = join(this.path, path)
        try {
            return await this.platform.read(fullPath)
        } catch (err: any) {
            if (err.code == "ENOENT") {
                return null
            }

            throw err
        }
    }

    constructor(
        public readonly platform: Platform,
        public readonly name: string,
        public readonly path: string,
    ) { }
}
