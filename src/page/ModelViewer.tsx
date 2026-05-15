import { AmbientLight, Box3, DirectionalLight, Object3D, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three"
import { GLTFLoader, OrbitControls } from "three/examples/jsm/Addons.js"
import { defineComponent } from "vue"
import { MountNode } from "../vue3gui/MountNode"
import { useEventListener } from "../vue3gui/util"

export class ModelViewerState {
    protected readonly _scene
    protected readonly _camera
    protected readonly _renderer
    protected readonly _orbit

    public get domElement() { return this._renderer.domElement }

    protected _lastModel: string | null = null
    protected _active: Object3D | null = null

    public resetCamera() {
        if (this._active == null) return

        this._orbit.reset()

        const boundingBox = new Box3().setFromObject(this._active)
        const center = boundingBox.getCenter(new Vector3())
        const size = boundingBox.getSize(new Vector3())

        this._orbit.target.copy(center)

        const direction = new Vector3(-1, 1, -1)
            .normalize()
            .multiplyScalar(size.length())

        this._camera.position.copy(center).add(direction)
        this._orbit.update()
    }

    public async showModel(model: Uint8Array | null, name: string) {
        if (this._active) {
            this._scene.remove(this._active)
            this._active = null
        }

        if (model == null) {
            this._lastModel = null
            return
        }

        const importer = new GLTFLoader()
        const gltf = await importer.parseAsync(model.buffer as ArrayBuffer, name)
        this._active = gltf.scene
        this._scene.add(this._active)

        if (this._lastModel != name) {
            this.resetCamera()
        }

        this._lastModel = name
    }

    public updateSize() {
        const box = this._renderer.domElement.getBoundingClientRect()

        const currSize = new Vector2()
        this._renderer.getSize(currSize)

        if (box.width == currSize.width && box.height == currSize.height) return

        this._renderer.setSize(box.width, box.height)
        this._camera.aspect = box.width / box.height
    }

    constructor() {
        this._scene = new Scene()
        this._camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)

        this._renderer = new WebGLRenderer({
            antialias: true,
        })
        this._renderer.setSize(window.innerWidth, window.innerHeight)
        this._renderer.domElement.classList.add("absolute-fill")
        this._renderer.domElement.style.width = "100%"
        this._renderer.domElement.style.height = "100%"
        this._renderer.setClearColor("#1a1a1a")

        this._orbit = new OrbitControls(this._camera, this.domElement)
        this._orbit.update()
        this._orbit.saveState()

        const center = new Object3D()
        this._scene.add(center)

        this._scene.add(new AmbientLight("#ffffff", 0.25))

        for (const [color, intensity, vector] of [
            ["#ffffff", 2, new Vector3(0.35, 1, 0.35)],
            ["#ffffff", 1.5, new Vector3(-1, 0, -1)],
        ] as const) {
            const directionalLight = new DirectionalLight(color, intensity)
            directionalLight.target = center
            this._scene.add(directionalLight)
            directionalLight.position.copy(vector.normalize())
        }

        this._renderer.setAnimationLoop(() => {
            this._renderer.render(this._scene, this._camera)
        })

        Object.assign(window, { VIEWER: this })
    }
}

export const ModelViewer = (defineComponent({
    name: "ModelViewer",
    props: {
        state: { type: ModelViewerState, required: true },
    },
    setup(props, ctx) {
        useEventListener("interval", 500, () => {
            props.state.updateSize()
        })

        return () => (
            <div>
                <MountNode node={props.state.domElement} />
            </div>
        )
    },
}))
