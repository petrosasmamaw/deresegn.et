/**
 * Free a TCP port so Expo can always bind 8081.
 * Usage: node scripts/free-port.js 8081
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const port = Number(process.argv[2] || 8081)
if (!Number.isFinite(port) || port < 1) {
  console.error('Usage: node scripts/free-port.js <port>')
  process.exit(1)
}

const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
const taskkill = path.join(systemRoot, 'System32', 'taskkill.exe')
const netstat = path.join(systemRoot, 'System32', 'netstat.exe')

function killPid(pid) {
  if (!pid || pid === '0') return false
  try {
    if (process.platform === 'win32') {
      execSync(`"${taskkill}" /PID ${pid} /F /T`, { stdio: 'ignore', windowsHide: true })
    } else {
      process.kill(Number(pid), 'SIGKILL')
    }
    return true
  } catch {
    return false
  }
}

function getWindowsPids(p) {
  try {
    if (!fs.existsSync(netstat)) {
      console.warn(`Port ${p}: netstat not found at ${netstat}`)
      return []
    }
    const out = execSync(`"${netstat}" -ano`, { encoding: 'utf8', windowsHide: true })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue
      if (!new RegExp(`:${p}\\s`).test(line)) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
    return [...pids]
  } catch (err) {
    console.warn(`Port ${p}: netstat failed (${err.message})`)
    return []
  }
}

function getUnixPids(p) {
  try {
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, { encoding: 'utf8' })
    return out.split(/\s+/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

const pids = process.platform === 'win32' ? getWindowsPids(port) : getUnixPids(port)

if (!pids.length) {
  console.log(`Port ${port}: free`)
} else {
  let n = 0
  for (const pid of pids) {
    if (killPid(pid)) {
      console.log(`Port ${port}: killed PID ${pid}`)
      n += 1
    } else {
      console.warn(`Port ${port}: could not kill PID ${pid}`)
    }
  }
  if (!n) console.warn(`Port ${port}: still occupied — close the other Expo/Metro terminal`)
}
