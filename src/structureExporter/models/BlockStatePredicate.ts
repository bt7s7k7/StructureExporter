import { unreachable } from "../../comTypes/util"
import { BlockState } from "../building/BlockState"
import { BlockStatePartCondition } from "../minecraft/assets"


export abstract class BlockStatePredicate {
    public abstract matches(state: BlockState): boolean

    public static fromString(properties: string): BlockStatePredicate {
        const predicate = new BlockStatePredicateProperties()
        if (properties == "") return predicate

        for (const property of properties.split(",")) {
            const [key, value] = property.split("=")
            predicate.setProperty(key, value)
        }

        return predicate
    }

    public static fromCondition(object: BlockStatePartCondition | undefined | null): BlockStatePredicate {
        if (object == null) return BlockStatePredicateAlways.INSTANCE

        if ("AND" in object) {
            if (!Array.isArray(object.AND)) unreachable()
            return new BlockStatePredicateCombinator(object.AND.map(v => this.fromCondition(v)), true)
        }

        if ("OR" in object) {
            if (!Array.isArray(object.OR)) unreachable()
            return new BlockStatePredicateCombinator(object.OR.map(v => this.fromCondition(v)), false)
        }

        const predicate = new BlockStatePredicateProperties()

        for (const [key, value] of Object.entries(object)) {
            // While the standards dictate that the value must be a string, some authors may decide
            // to use a different type (this is honestly understandable, if annoying, because you
            // might have a block state value of a boolean or a number type, so your first instinct
            // is to use a boolean in the filter as well). Minecraft handles this, so we must as well.
            predicate.setProperty(key, typeof value == "string" ? value : `${value}`)
        }

        return predicate
    }

}

export class BlockStatePredicateCombinator extends BlockStatePredicate {
    public override matches(state: BlockState): boolean {
        if (this.requireAll) {
            for (const predicate of this.predicates) {
                if (!predicate.matches(state)) return false
            }

            return true
        } else {
            for (const predicate of this.predicates) {
                if (predicate.matches(state)) return true
            }

            return false
        }
    }

    constructor(
        public readonly predicates: BlockStatePredicate[],
        public readonly requireAll: boolean,
    ) { super() }
}

export class BlockStatePredicateProperties extends BlockStatePredicate {
    protected _properties: Map<string, string | string[]> | null = null

    public setProperty(key: string, value: string) {
        let normalisedValue
        normalisedValue = value
        if (normalisedValue.includes("|")) {
            normalisedValue = normalisedValue.split("|")
        }

        (this._properties ??= new Map()).set(key, normalisedValue)
        return this
    }

    public override matches(state: BlockState): boolean {
        if (this._properties == null) return true
        if (state["_properties"] == null) return false

        for (const [key, value] of this._properties) {
            if (Array.isArray(value)) {
                if (!value.includes(state["_properties"].get(key)!)) return false
            } else {
                if (state["_properties"].get(key) != value) return false
            }
        }

        return true
    }
}

export class BlockStatePredicateAlways extends BlockStatePredicate {
    public override matches(state: BlockState): boolean {
        return true
    }

    protected constructor() { super() }
    public static readonly INSTANCE = new this()
}
