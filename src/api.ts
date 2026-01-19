import fs from 'fs'

const DEFAULT_PADDING = '          '

function pad(pad: string, str: string, padLeft?: boolean) {
  if (typeof str === 'undefined') return pad
  if (padLeft) {
    return (pad + str).slice(-pad.length)
  } else {
    return (str + pad).substring(0, pad.length)
  }
}

export namespace LogUtils {
  export interface AppEntry {
    app_name: string
    path: string
    type: 'out' | 'err' | 'PM2'
  }

  export function format(entry: AppEntry, line: string) {
    let header = ''
    if (entry.type === 'out') {
      header = `\u001b[32m${pad(DEFAULT_PADDING, entry.app_name)} | \u001b[39m`
    } else if (entry.type === 'err') {
      header = `\u001b[31m${pad(DEFAULT_PADDING, entry.app_name)} | \u001b[39m`
    } else {
      header = `\u001b[36m${pad(DEFAULT_PADDING, 'PM2')} | \u001b[39m`
    }
    return header + line
  }

  export async function tail(entries: AppEntry[], lines: number, raw: boolean): Promise<string[]> {
    if (lines === 0 || entries.length === 0) return []

    const getLastLines = async function (filename: string, lines: number) {
      return new Promise<string[]>(function (resolve) {
        let chunk = ''
        const size = Math.max(0, fs.statSync(filename).size - (lines * 200))

        const fd = fs.createReadStream(filename, { start: size })
        fd.on('data', function (data) { chunk += data.toString() })
        fd.on('end', function () {
          const chunks = chunk.split('\n').slice(-(lines + 1))
          chunks.pop()
          resolve(chunks)
        })
        fd.on('error', function () { resolve([]) })
      })
    }

    entries.sort(function (a, b) {
      return (fs.existsSync(a.path) ? fs.statSync(a.path).mtime.valueOf() : 0) - (fs.existsSync(b.path) ? fs.statSync(b.path).mtime.valueOf() : 0)
    })

    const output: string[] = []
    for (const app of entries) {
      if (!fs.existsSync(app.path || '')) continue
      const lastLines = await getLastLines(app.path, lines)
      lastLines.forEach(line => output.push(raw ? line : format(app, line)))
      if (lastLines.length) output.push('')
    }
    return output
  }
}
