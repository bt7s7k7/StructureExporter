import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import * as dotenv from "dotenv"
import { join } from "path"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    dotenv.config({ path: join(__dirname, ".env.local") })
    dotenv.config({ path: join(__dirname, ".env") })

    return {
        plugins: [
            vue(), vueJsx(),
            nodePolyfills({ include: ["path"] }),
        ],
        resolve: {
            preserveSymlinks: true,
        },
        server: {
            port: +(process.env.PORT ?? 8080),
        },
        base: mode == "development" ? "/" : process.env.BASE_URL,
    }
})
