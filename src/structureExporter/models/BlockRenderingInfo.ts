import { BlockState } from "../building/BlockState"
import { BlockModel } from "./BlockModel"
import { BlockStatePredicate } from "./BlockStatePredicate"


export class BlockRenderingInfo {
    public isFullBlock = true
    public isOpaque = true

    protected readonly _models: [BlockStatePredicate, BlockModel][] = []

    public registerModel(state: BlockStatePredicate, model: BlockModel) {
        this._models.push([state, model])
    }

    public findModel(target: BlockState) {
        for (const [state, model] of this._models) {
            if (state.matches(target)) {
                return model
            }
        }

        return null
    }

    public *findModels(target: BlockState) {
        for (const [state, model] of this._models) {
            if (state.matches(target)) {
                yield model
            }
        }
    }

    public getModels() {
        return new Set(this._models.map(([, model]) => model))
    }

    constructor(
        public readonly isMultipart: boolean,
    ) { }
}
