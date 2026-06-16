import { Drawer } from "../drawer/Drawer"
import { Plugin } from "./plugins/Plugin"

export function decodeString(source: Uint8Array) {
    if (source.constructor.name == "Buffer") {
        return (source as Buffer).toString("utf-8")
    }

    return new TextDecoder().decode(source)
}

export abstract class Platform {
    public abstract mkdir(path: string): Promise<void>
    public abstract readdir(path: string): AsyncGenerator<{ isDirectory(): boolean, name: string }>
    public abstract rm(path: string): Promise<void>
    public abstract read(path: string): Promise<Uint8Array>
    public abstract write(path: string, content: string | Uint8Array): Promise<void>
    public abstract loadImage(data: Uint8Array): Promise<Drawer.ImageSource & { width: number, height: number }>
    public abstract saveImage(image: Drawer): Promise<Uint8Array>
    public abstract loadPlugin(path: string): Promise<Plugin>
}
