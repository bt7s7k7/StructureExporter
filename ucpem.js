/// <reference path="./.vscode/config.d.ts" />

const { readFile, writeFile } = require("node:fs/promises")
const { project, github, run, join, constants, ucpem } = require("ucpem")

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

project.script("export-structure", async (args) => {
    await run("ucpem run builder build")
    process.argv = [...process.argv.slice(0, 2), ...args]
    await import(join(constants.projectPath, "./build/index.mjs"))
}, { desc: "Executes the structure exporter CLI with the provided arguments", argc: NaN })
