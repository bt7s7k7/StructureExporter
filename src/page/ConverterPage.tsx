import { mdiCancel, mdiFileOutline, mdiFolderOutline } from "@mdi/js"
import { basename, extname, join } from "node:path"
import { defineComponent, inject, ref, shallowReactive } from "vue"
import { EMPTY_ARRAY } from "../comTypes/const"
import { makeRandomID, unreachable } from "../comTypes/util"
import { ResourcePackManager } from "../structureExporter/resources/ResourcePackManager"
import { error, info } from "../structureExporter/support/log"
import { Stopwatch } from "../structureExporter/support/Stopwatch"
import { Button } from "../vue3gui/Button"
import { useDynamicsEmitter } from "../vue3gui/DynamicsEmitter"
import { grid } from "../vue3gui/grid"
import { MountNode } from "../vue3gui/MountNode"
import { TextField } from "../vue3gui/TextField"
import { ToggleButton } from "../vue3gui/ToggleButton"
import { UploadOverlay } from "../vue3gui/UploadOverlay"
import { BROWSER_PLATFORM } from "./BrowserPlatform"
import { FileList } from "./FileList"

export const ConverterPage = (defineComponent({
    name: "ConverterPage",
    setup(props, ctx) {
        const resources: string[] = shallowReactive([])
        const platform = inject(BROWSER_PLATFORM) ?? unreachable()
        const emitter = useDynamicsEmitter()

        async function reloadResources() {
            await platform.invalidateCache()

            resources.length = 0
            const manager = await ResourcePackManager.createOrOpen(platform, null)
            for (const pack of manager.packs) {
                resources.push(pack.name)
            }
        }

        void reloadResources()

        async function uploadResources(resourceFiles: readonly File[] = EMPTY_ARRAY) {
            const resources = shallowReactive(resourceFiles.map(file => ({ name: file.name, file })))
            const name = ref("")
            const merge = ref(false)

            const success = await emitter.modal((
                <UploadOverlay
                    onDrop={files => resources.push(...files.map(file => ({ name: file.name, file })))}
                    class="flex column gap-2"
                >
                    <FileList
                        class="h-300"
                        files={resources.map(v => v.name)}
                        icon={mdiFileOutline}
                        placeholder="Drag and drop file"
                        onDelete={i => resources.splice(i, 1)}
                        onRename={(i, name) => resources[i].name = name}
                    >
                        Files
                    </FileList>
                    <ToggleButton plain label="Merge" vModel={merge.value} />
                    <label class="flex row gap-2">
                        Name
                        <TextField class="flex-fill" vModel={name.value} />
                    </label>
                    <small class="muted">Keep name empty to import all resources individually.</small>
                </UploadOverlay>
            ), {
                props: {
                    class: "width-300",
                    okButton: "Import",
                    cancelButton: true,
                },
            })

            if (!success) {
                info("Import cancelled")
                return
            }

            name.value = name.value.trim()
            using _1 = new DisposableStack()
            _1.defer(() => { Stopwatch.dump(); Stopwatch.clear() })
            _1.defer(() => reloadResources())

            try {
                using stopwatch = new Stopwatch().start("import")

                const resourcePacks = await ResourcePackManager.createOrOpen(platform, null)
                const method = merge.value ? "getOrCreatePack" : "createOrOverwritePack"

                if (!merge.value && name.value) {
                    await platform.setMapping("resources/" + name.value, "resources/" + name.value + "_" + makeRandomID())
                }

                const globalPack = name.value ? await resourcePacks[method](name.value) : null

                for (const { name, file } of resources) {
                    const nameWithoutExtension = basename(name, extname(name))

                    if (!merge.value && globalPack == null) {
                        await platform.setMapping("resources/" + nameWithoutExtension, "resources/" + nameWithoutExtension + "_" + makeRandomID())
                    }

                    const pack = globalPack ?? await resourcePacks[method](nameWithoutExtension)
                    const data = await file.bytes()
                    await pack.importSource(data)
                }

                info("Import finished")
            } catch (err: any) {
                error("Import failed: " + err.message)
                // oxlint-disable-next-line no-console
                console.error(err)
            }
        }

        function handleFile(files: File[]) {
            const extensions = files.map(v => extname(v.name))

            if (extensions.every(v => v == ".zip" || v == ".jar")) {
                void uploadResources(files)
            } else {
                void emitter.alert("Unsupported file")
            }
        }

        async function deleteResource(index: number) {
            if (!await emitter.confirm("Are you sure?")) return

            const work = emitter.work("Deleting...")
            try {
                const name = resources[index]
                await platform.rm(join("resources", name))
            } finally {
                work.done()
                await reloadResources()
            }
        }

        async function renameResource(index: number, newName: string) {
            const work = emitter.work("Renaming...")
            try {
                const name = resources[index]
                const mappings = await platform.getMappings()

                const oldPath = join("resources", name)
                const newPath = join("resources", newName)

                const target = mappings[oldPath] ?? unreachable()
                await platform.setMapping(oldPath, null)
                await platform.setMapping(newPath, target)
            } finally {
                work.done()
                await reloadResources()
            }
        }

        return () => (
            <UploadOverlay style={grid().columns("1fr", "200px").rows("auto", "1fr").$} class="flex-fill" onDrop={handleFile}>
                <div style={grid().colspan(2).$} class="border-bottom flex row">
                    <Button clear label="New" />
                    <div class="flex-fill"></div>
                    <Button clear icon={mdiFolderOutline} label="Import Resource" onClick={() => uploadResources()} />
                </div>
                <div class="border-right">
                    <div class="absolute bottom-0 left-0 p-2 flex column gap-2 start-cross">
                        <MountNode node={platform.logElement} />
                        <Button v-label:right="Clear Log" icon={mdiCancel} onClick={() => platform.clearLog()} />
                    </div>
                </div>
                <div class="p-2 flex column gap-2">
                    <FileList
                        files={resources}
                        icon={mdiFileOutline}
                        placeholder={"No resources loaded"}
                        class="h-500"
                        onDelete={deleteResource}
                        onRename={renameResource}
                    >
                        Resources
                    </FileList>
                </div>
            </UploadOverlay>
        )
    },
}))
