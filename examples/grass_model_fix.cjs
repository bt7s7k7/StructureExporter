// @ts-check

const { declarePlugin, Color, ResourceProvider, unreachable, Drawer } = require("structure-exporter")

module.exports = () => {
    /** @type {ResourceProvider} */
    let resourceProvider

    const tint = Color.fromHex("#82cf4e")

    return declarePlugin({
        name: "grass_model_fix",
        async onBeforePrepareAssets(...args) {
            resourceProvider = args[1]
        },
        async onLoadTextureContent(value, id) {
            if (id == "minecraft:block/grass_block_top") {
                value
                    .setGlobalCompositeOperation("multiply")
                    .setStyle(tint).fillRect()
                    .setGlobalCompositeOperation(null)
            } else if (id == "minecraft:block/grass_block_side") {
                const overlayTexture = (await resourceProvider.loadTexture("minecraft:block/grass_block_side_overlay")) ?? unreachable()
                const result = new Drawer()
                    .matchSize(value)
                    .blit(overlayTexture.image)
                    .setGlobalCompositeOperation("multiply")
                    .setStyle(tint).fillRect()
                    .setGlobalCompositeOperation("destination-in")
                    .blit(overlayTexture.image)
                    .setGlobalCompositeOperation("destination-over")
                    .blit(value)

                return result
            }
        },
        async onLoadModelDefinition(value, id) {
            if (id == "minecraft:block/grass_block") {
                value.elements = (value.elements ?? []).filter(v => !JSON.stringify(v).includes("#overlay"))
            }
        },
    })
}
