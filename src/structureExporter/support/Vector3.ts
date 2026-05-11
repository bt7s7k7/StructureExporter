export class Vector3 {
    public add(other: Vector3) {
        return new Vector3(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z,
        )
    }

    public add1(t: number) {
        return new Vector3(
            this.x + t,
            this.y + t,
            this.z + t,
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

    public sub1(t: number) {
        return new Vector3(
            this.x - t,
            this.y - t,
            this.z - t,
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

    public with(component: "x" | "y" | "z", value: number) {
        if (component == "x") return new Vector3(value, this.y, this.z)
        if (component == "y") return new Vector3(this.x, value, this.z)
        return new Vector3(this.x, this.y, value)
    }

    public withoutZeroes() {
        return new Vector3(
            this.x == 0 ? 1e-6 : this.x,
            this.y == 0 ? 1e-6 : this.y,
            this.z == 0 ? 1e-6 : this.z,
        )
    }

    public get magnitude() { return Math.hypot(this.x, this.y, this.z) }
    public get normalized() { return this.div1(this.magnitude) }
    public get isZero() { return this.x == 0 && this.y == 0 && this.z == 0 }

    public toArray(): [number, number, number] { return [this.x, this.y, this.z] }
    public toMapKey() { return `${this.x},${this.y},${this.z}` }

    public eulerToQuaternionZYX() {
        const roll = this.x
        const pitch = this.y
        const yaw = this.z

        const cr = Math.cos(roll * 0.5)
        const sr = Math.sin(roll * 0.5)
        const cp = Math.cos(pitch * 0.5)
        const sp = Math.sin(pitch * 0.5)
        const cy = Math.cos(yaw * 0.5)
        const sy = Math.sin(yaw * 0.5)

        const w = cr * cp * cy + sr * sp * sy
        const x = sr * cp * cy - cr * sp * sy
        const y = cr * sp * cy + sr * cp * sy
        const z = cr * cp * sy - sr * sp * cy

        return [x, y, z, w] as [number, number, number, number]
    }

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

    public static fromObject(source: { x: number, y: number, z: number }) {
        const { x, y, z } = source
        return new Vector3(x, y, z)
    }

    public static readonly ZERO = this.from1(0)
    public static readonly ONE = this.from1(1)
}
