// @ts-check

module.exports = {
    modifyOptions(/** @type {import("esbuild").BuildOptions} */ options) {
        options.packages = "external"
    },
}
