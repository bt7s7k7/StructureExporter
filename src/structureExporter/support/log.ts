export const LOGGER = {
    print(...msgs: any[]) {
        // oxlint-disable-next-line no-console
        console.log(...msgs)
    },
    debug(...msgs: any[]) {
        process.stdout.write("\x1b[2m")
        // oxlint-disable-next-line no-console
        console.log(...msgs)
        process.stdout.write("\x1b[22m")
    },
    info(...msgs: any[]) {
        process.stdout.write("\x1b[96m")
        // oxlint-disable-next-line no-console
        console.log(...msgs)
        process.stdout.write("\x1b[0m")
    },
    warn(...msgs: any[]) {
        process.stdout.write("\x1b[93m")
        // oxlint-disable-next-line no-console
        console.log(...msgs)
        process.stdout.write("\x1b[0m")
    },
    error(...msgs: any[]) {
        process.stdout.write("\x1b[91m")
        // oxlint-disable-next-line no-console
        console.log(...msgs)
        process.stdout.write("\x1b[0m")
    },
}

export function print(...msgs: any[]) {
    LOGGER.print(...msgs)
}

export function debug(...msgs: any[]) {
    LOGGER.debug(...msgs)
}

export function info(...msgs: any[]) {
    LOGGER.info(...msgs)
}

export function warn(...msgs: any[]) {
    LOGGER.warn(...msgs)
}

export function error(...msgs: any[]) {
    LOGGER.error(...msgs)
}
