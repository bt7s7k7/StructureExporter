export function print(...msgs: any[]) {
    // oxlint-disable-next-line no-console
    console.log(...msgs)
}

const _debugEnabled = !!process.env.DEBUG
export function debug(...msgs: any[]) {
    if (!_debugEnabled) return
    process.stdout.write("\x1b[2m")
    // oxlint-disable-next-line no-console
    console.log(...msgs)
    process.stdout.write("\x1b[22m")
}

export function info(...msgs: any[]) {
    process.stdout.write("\x1b[96m")
    // oxlint-disable-next-line no-console
    console.log(...msgs)
    process.stdout.write("\x1b[0m")
}

export function warn(...msgs: any[]) {
    process.stdout.write("\x1b[93m")
    // oxlint-disable-next-line no-console
    console.log(...msgs)
    process.stdout.write("\x1b[0m")
}

export function error(...msgs: any[]) {
    process.stdout.write("\x1b[91m")
    // oxlint-disable-next-line no-console
    console.log(...msgs)
    process.stdout.write("\x1b[0m")
}
