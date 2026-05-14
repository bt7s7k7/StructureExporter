/// <reference path="./.vscode/config.d.ts" />

const { project, github, run } = require("ucpem")

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
