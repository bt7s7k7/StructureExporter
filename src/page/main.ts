import { createApp } from "vue"
import "../vue3gui/style.scss"
import { vue3gui } from "../vue3gui/vue3gui"
import { App } from "./App"

const app = createApp(App)

app.use(vue3gui, {})

app.mount("#app")
