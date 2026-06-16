/// <reference path="./.vscode/config.d.ts" />

const { readFile, writeFile } = require("node:fs/promises")
const { project, github, run, join, constants } = require("ucpem")

project.prefix("src").res("structureExporter",
    github("bt7s7k7/MiniML").res("cli"),
    github("bt7s7k7/Drawer").res("drawer"),
)

project.use(github("bt7s7k7/Apsides").script("builder"))
project.prefix("src").use(github("bt7s7k7/Vue3GUI").res("vue3gui"))

project.script("dev", async () => {
    void run("yarn vite")
    void run("yarn tsc --noEmit --watch --incremental --preserveWatchOutput --pretty")
})

project.script("plugin-api", async () => {
    let definition = await readFile(join(constants.projectPath, "plugin-api.d.ts"), "utf-8")

    definition = definition
        .trim()
        .replace(/declare /g, "")
        .replace(/^/, `declare module "structure-exporter" {\n`)
        + "\n}\n"

    await writeFile(join(constants.projectPath, "plugin-api.d.ts"), definition)
    await run("yarn oxlint --fix plugin-api.d.ts")
    await run("yarn oxlint --fix plugin-api.d.ts")
})
