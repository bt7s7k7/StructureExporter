import { defineComponent, provide } from "vue"
import { DynamicsEmitter } from "../vue3gui/DynamicsEmitter"
import { BROWSER_PLATFORM, BrowserPlatform } from "./BrowserPlatform"
import { ConverterPage } from "./ConverterPage"

export const App = (defineComponent({
    name: "App",
    setup(props, ctx) {
        provide(BROWSER_PLATFORM, BrowserPlatform.create())

        return () => (
            <DynamicsEmitter>
                <ConverterPage />
            </DynamicsEmitter>
        )
    },
}))
