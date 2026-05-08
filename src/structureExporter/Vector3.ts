export class Vector3 {
    public add(other: Vector3) {
        return new Vector3(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z,
        )
    }

    public add3(x: number, y: number, z: number) {
        return new Vector3(
            this.x + x,
            this.y + y,
            this.z + z,
        )
    }

    public sub(other: Vector3) {
        return new Vector3(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z,
        )
    }

    public sub3(x: number, y: number, z: number) {
        return new Vector3(
            this.x - x,
            this.y - y,
            this.z - z,
        )
    }

    public mul(other: Vector3) {
        return new Vector3(
            this.x * other.x,
            this.y * other.y,
            this.z * other.z,
        )
    }

    public mul1(t: number) {
        return new Vector3(
            this.x * t,
            this.y * t,
            this.z * t,
        )
    }

    public mul3(x: number, y: number, z: number) {
        return new Vector3(
            this.x * x,
            this.y * y,
            this.z * z,
        )
    }

    public div(other: Vector3) {
        return new Vector3(
            this.x / other.x,
            this.y / other.y,
            this.z / other.z,
        )
    }

    public div1(t: number) {
        return new Vector3(
            this.x / t,
            this.y / t,
            this.z / t,
        )
    }

    public div3(x: number, y: number, z: number) {
        return new Vector3(
            this.x / x,
            this.y / y,
            this.z / z,
        )
    }

    public get magnitude() { return Math.hypot(this.x, this.y, this.z) }
    public get normalized() { return this.div1(this.magnitude) }

    public toArray(): [number, number, number] { return [this.x, this.y, this.z] }
    public toMapKey() { return `${this.x},${this.y},${this.z}` }

    public *[Symbol.iterator]() {
        yield this.x
        yield this.y
        yield this.z
    }

    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
    ) { }

    public static from1(t: number) { return new Vector3(t, t, t) }
    public static fromArray(source: ArrayLike<number>, start = 0) {
        return new Vector3(source[start + 0], source[start + 1], source[start + 2])
    }

    public static readonly ZERO = this.from1(0)
    public static readonly ONE = this.from1(1)
}
