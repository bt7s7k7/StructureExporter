/// <reference path="./.vscode/config.d.ts" />

const { project, github } = require("ucpem")

project.prefix("src").res("structureExporter",
    github("bt7s7k7/MiniML").res("cli"),
)

project.use(github("bt7s7k7/Apsides").script("builder"))
