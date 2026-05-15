import { Document, PropertyType, WebIO } from "@gltf-transform/core"
import { dedup, flatten, join as join_2 } from "@gltf-transform/functions"
import { mdiCancel, mdiCubeOutline, mdiDownload, mdiFileOutline, mdiFolderOutline } from "@mdi/js"
import { basename, extname, join } from "node:path"
import { defineComponent, inject, ref, shallowReactive, shallowRef } from "vue"
import { EMPTY_ARRAY, NOOP } from "../comTypes/const"
import { makeRandomID, toBase64Binary, unreachable } from "../comTypes/util"
import { BlockBuilder } from "../structureExporter/building/BlockBuilder"
import { Structure } from "../structureExporter/building/Structure"
import { ModelProvider } from "../structureExporter/models/ModelProvider"
import { ResourcePackManager } from "../structureExporter/resources/ResourcePackManager"
import { ResourceProvider } from "../structureExporter/resources/ResourceProvider"
import { error, info, print } from "../structureExporter/support/log"
import { Stopwatch } from "../structureExporter/support/Stopwatch"
import { TextureAtlas } from "../structureExporter/textures/TextureAtlas"
import { Button, ButtonGroup } from "../vue3gui/Button"
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
        
        const simplify = ref(false)
        const dryRun = ref(false)

        const inputFile = shallowRef<Uint8Array | null>(null)
        const inputFileName = ref("")
        const atlasFile = shallowRef<Uint8Array | null>(null)
        const modelFile = shallowRef<Uint8Array | null>(null)
        const storageEstimate = ref("")

        const show = ref<"atlas" | "model">("model")

        const cachedResources = shallowRef<[ResourcePackManager, ResourceProvider] | null>(null)

        function reloadSavedState() {
            void platform.read("input.nbt").then(v => inputFile.value = v, NOOP)
            void platform.read("input.txt").then(v => inputFileName.value = new TextDecoder().decode(v), NOOP)
            void platform.read("atlas.png").then(v => atlasFile.value = v, NOOP)
            void platform.read("model.glb").then(v => modelFile.value = v, NOOP)
        }

        async function calculateStorageEstimate() {
            const estimate = await navigator.storage.estimate()
            const value = "usageDetails" in estimate ? (estimate.usageDetails as any).fileSystem : estimate.usage
            if (value == null) {
                storageEstimate.value = ""
            } else if (value > 1024 ** 2) {
                storageEstimate.value = `${(value / 1024 ** 2).toFixed(3)} MiB`
            } else {
                storageEstimate.value = `${(value / 1024).toFixed(3)} KiB`
            }
        }

        reloadSavedState()

        async function reloadResources() {
            await platform.invalidateCache()

            resources.length = 0
            const manager = await ResourcePackManager.createOrOpen(platform, null)
            for (const pack of manager.packs) {
                resources.push(pack.name)
            }

            cachedResources.value = [manager, new ResourceProvider(platform, manager)]

            await calculateStorageEstimate()
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
            } else if (extensions.every(v => v == ".nbt")) {
                if (files.length != 1) return emitter.alert("Too many files")
                void setInput(files[0])
            } else {
                void emitter.alert("Unsupported file")
            }
        }

        async function setInput(file: File | null) {
            modelFile.value = null
            atlasFile.value = null

            if (file == null) {
                inputFile.value = null
                await platform.rm("input.nbt").catch(NOOP)
                await platform.rm("input.txt").catch(NOOP)
            } else {
                inputFileName.value = file.name
                inputFile.value = await file.bytes()
                await platform.write("input.nbt", inputFile.value)
                await platform.write("input.txt", inputFileName.value)
            }

            await platform.rm("model.glb").catch(NOOP)
            await platform.rm("atlas.png").catch(NOOP)

            await calculateStorageEstimate()
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

        async function rebuild() {
            Stopwatch.clear()
            platform.clearLog()

            using disposer = new DisposableStack()
            disposer.defer(() => Stopwatch.dump())
            disposer.defer(() => calculateStorageEstimate())

            if (!inputFile.value) unreachable()
            const inputData = inputFile.value

            if (cachedResources.value == null) {
                await reloadResources()
            }

            const [, resourceProvider] = cachedResources.value!

            print("Loading resources...")

            const structure = await Structure.load(inputData.buffer as ArrayBuffer)
            const document = new Document()
            const scene = document.createScene()

            const modelProvider = new ModelProvider(resourceProvider)
            modelProvider.assetLoadingConcurrency = 5

            await modelProvider.prepareAssets(structure.getAssets())

            const atlas = await TextureAtlas.build(platform, document, modelProvider)
            atlasFile.value = atlas.content
            show.value = "atlas"
            void platform.write("atlas.png", atlas.content)
            if (dryRun.value) return

            print("Building model...")

            const blockBuilder = new BlockBuilder(document, modelProvider, atlas)
            blockBuilder.buildStructure(structure, scene)

            print("Simplifying...")

            const stopwatch = new Stopwatch().start("simplify")
            if (simplify.value) {
                await document.transform(
                    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
                    flatten(),
                    join_2(),
                )
            } else {
                await document.transform(
                    dedup({ propertyTypes: [PropertyType.ACCESSOR] }),
                )
            }
            stopwatch.end()

            const io = new WebIO()
            modelFile.value = await io.writeBinary(document)
            void platform.write("model.glb", modelFile.value)
            show.value = "model"

            print("Done")
        }

        function downloadAtlas()  {
            if (atlasFile.value == null) return
            const url = URL.createObjectURL(new Blob([atlasFile.value.buffer as ArrayBuffer], { type: "image/png" }))
            const download = document.createElement("a")
            download.download = basename(inputFileName.value, extname(inputFileName.value)) + ".png"
            download.href = url
            download.click()
        }

        function downloadModel()  {
            if (modelFile.value == null) return
            const url = URL.createObjectURL(new Blob([modelFile.value.buffer as ArrayBuffer], { type: "model/gltf-binary" }))
            const download = document.createElement("a")
            download.download = basename(inputFileName.value, extname(inputFileName.value)) + ".glb"
            download.href = url
            download.click()
        }

        return () => (
            <UploadOverlay style={grid().columns("1fr", "200px").rows("auto", "1fr").$} class="flex-fill" onDrop={handleFile}>
                <div style={grid().colspan(2).$} class="border-bottom flex row center-cross">
                    <Button clear label="New" />
                    <div class="flex-fill"></div>
                    {storageEstimate.value && (
                        <small>
                            Storage: {storageEstimate.value}
                        </small>
                    )}
                    <Button clear icon={mdiFolderOutline} label="Import Resource" onClick={() => uploadResources()} />
                </div>
                <div class="border-right">
                    {atlasFile.value != null && show.value == "atlas" && (
                        <img class="absolute-fill img-contain pixelated bg-dark" src={"data:image/png;base64," + toBase64Binary(atlasFile.value)} />
                    )}
                    <div class="absolute bottom-0 left-0 p-2 flex column gap-2 start-cross" style="max-width: 800px">
                        <MountNode node={platform.logElement} />
                        <Button v-label:right="Clear Log" icon={mdiCancel} onClick={() => platform.clearLog()} />
                    </div>
                </div>
                <div class="p-2 flex column gap-2">
                    <div class="border rounded">
                        <div class="p-1 px-2 border-bottom">Structure</div>
                        {inputFile.value ? (
                            <div class="p-2 flex row">
                                <TextField modelValue={inputFileName.value} class="flex-fill" clear disabled />
                                <Button clear icon={mdiCancel} onClick={() => setInput(null)} />
                            </div>
                        ) : (
                            <div class="p-2 muted">Drop a structure file</div>
                        )}
                    </div>
                    <ToggleButton plain label="Simplify" vModel={simplify.value} />
                    <ToggleButton plain label="Dry Run" vModel={dryRun.value} />
                    <div class="flex row">
                        <ButtonGroup disabled={atlasFile.value == null}>
                            <Button class="flex-fill" variant={show.value == "atlas" ? "primary" : "secondary"}  label="Atlas" onClick={() => show.value = "atlas"} />
                            <Button clear icon={mdiDownload} onClick={downloadAtlas} />
                        </ButtonGroup>
                    </div>
                    <div class="flex row">
                        <ButtonGroup disabled={modelFile.value == null}>
                            <Button class="flex-fill" variant={show.value == "model" ? "primary" : "secondary"} disabled={modelFile.value == null} label="Model" onClick={() => show.value = "model"} />
                            <Button clear icon={mdiDownload} onClick={downloadModel} />
                        </ButtonGroup>
                    </div>
                    <Button variant="success" disabled={inputFile.value == null} label="Build" icon={mdiCubeOutline} onClick={rebuild} />
                    <div class="border-bottom"></div>
                    <FileList
                        files={resources}
                        icon={mdiFileOutline}
                        placeholder={"No resources loaded"}
                        class="flex-fill"
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
