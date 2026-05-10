import { BlockModel } from "./BlockModel"
import { BlockState } from "./BlockState"
import { BlockStatePredicate } from "./BlockStatePredicate"


export class BlockRenderingInfo {
    public isFullBlock = true
    public isOpaque = true

    protected readonly _states: [BlockStatePredicate, BlockModel][] = []

    public registerModel(state: BlockStatePredicate, model: BlockModel) {
        this._states.push([state, model])
    }

    public findModel(target: BlockState) {
        for (const [state, model] of this._states) {
            if (state.matches(target)) {
                return model
            }
        }

        return null
    }

    public *findModels(target: BlockState) {
        for (const [state, model] of this._states) {
            if (state.matches(target)) {
                yield model
            }
        }
    }

    public getModels() {
        return new Set(this._states.map(([, model]) => model))
    }

    constructor(
        public readonly multipart: boolean,
    ) { }
}
