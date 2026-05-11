import StreamZip from "node-stream-zip"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { asyncConcurrency } from "../../comTypes/util"
import { print } from "../support/log"

export class ResourcePack {
    public async importSource(path: string) {
        const zip = new StreamZip.async({ file: path })

        const existingPaths = new Set<string>()
        const queue = asyncConcurrency<any>(100)

        for (const entry of Object.values(await zip.entries())) {
            // Only get files from relevant directories, that is blockstates and block models and
            // textures. The "custom" directory is included for compatibility with
            // DecorativeBlocks-Reborn, which breaks the folder structure standard.
            if (!entry.isDirectory && entry.name.match(/^assets\/\w+\/(textures\/(?:block|custom)|blockstates|models\/(?:block|custom))\//)) {
                const targetPath = join(this.path, entry.name)
                const targetDirname = dirname(targetPath)

                if (!existingPaths.has(targetDirname)) {
                    await mkdir(targetDirname, { recursive: true })
                    print(`Extracting: ${relative(this.path, targetDirname)}`)
                    existingPaths.add(targetDirname)
                }

                queue.push(() => zip.extract(entry.name, targetPath))
            }
        }

        await queue.join()
        await zip.close()
    }

    public async loadResource(path: string) {
        const fullPath = join(this.path, path)
        try {
            return await readFile(fullPath)
        } catch (err: any) {
            if (err.code == "ENOENT") {
                return null
            }

            throw err
        }
    }

    constructor(
        public readonly name: string,
        public readonly path: string,
    ) { }
}
