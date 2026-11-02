/**
 * Tiny dependency-free QR encoder (byte mode, error correction M, versions 1–10, up to 213 bytes).
 * Enough for order links / short URLs. Algorithm follows ISO/IEC 18004 (same structure as Nayuki's reference).
 * Port of the web admin's lib/qr.ts — keep the two in sync. Uses a local UTF-8 encoder instead of TextEncoder
 * so it runs on every JS engine React Native ships with.
 */

/** UTF-8 bytes of a string (surrogate pairs combined). */
function utf8Bytes(text: string): number[] {
  const out: number[] = []
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(i + 1)
      if (lo >= 0xdc00 && lo <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00); i++ }
    }
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const MAX_VERSION = 10

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}

const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const r = new Array(degree).fill(0)
  r[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return r
}

function rsRemainder(data: number[], div: number[]): number[] {
  const r = new Array(div.length).fill(0)
  for (const b of data) {
    const f = b ^ (r.shift() as number)
    r.push(0)
    div.forEach((c, i) => { r[i] ^= gfMul(c, f) })
  }
  return r
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

/** Module matrix (true = dark), or null when the text is too long. `forceMask` (0–7) skips the mask search. */
export function qrMatrix(text: string, forceMask?: number): boolean[][] | null {
  const bytes = utf8Bytes(text)
  let ver = 1
  for (; ver <= MAX_VERSION; ver++) {
    const ccBits = ver <= 9 ? 8 : 16
    if (4 + ccBits + bytes.length * 8 <= dataCodewords(ver) * 8) break
  }
  if (ver > MAX_VERSION) return null

  // Data bits
  const bits: number[] = []
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1) }
  put(4, 4)
  put(bytes.length, ver <= 9 ? 8 : 16)
  bytes.forEach((b) => put(b, 8))
  const cap = dataCodewords(ver) * 8
  put(0, Math.min(4, cap - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2))

  // Error correction + interleave
  const nBlocks = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawDataModules(ver) / 8)
  const nShort = nBlocks - (raw % nBlocks)
  const shortLen = Math.floor(raw / nBlocks)
  const div = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < nShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) codewords.push(b[i]) })
  }

  // Function patterns
  const size = ver * 4 + 17
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (x: number, y: number, dark: boolean) => { m[y][x] = dark; fn[y][x] = true }

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4)
    }
  }
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
    const pos = [6]
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p)
    pos.forEach((px, i) => pos.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }))
  }
  const drawFormat = (mask: number) => {
    const d = (0 << 3) | mask // ECC M = 00
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((d << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i))
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i))
    set(8, size - 8, true)
  }
  drawFormat(0)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), c = Math.floor(i / 3)
      set(a, c, bit(b, i)); set(c, a, bit(b, i))
    }
  }

  // Codewords (zig-zag)
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j
      const y = ((right + 1) & 2) === 0 ? size - 1 - v : v
      if (!fn[y][x] && i < codewords.length * 8) { m[y][x] = bit(codewords[i >>> 3], 7 - (i & 7)); i++ }
    }
  }

  const masked = (mask: number) => m.map((row, y) => row.map((dark, x) => {
    if (fn[y][x]) return dark
    let inv: boolean
    switch (mask) {
      case 0: inv = (x + y) % 2 === 0; break
      case 1: inv = y % 2 === 0; break
      case 2: inv = x % 3 === 0; break
      case 3: inv = (x + y) % 3 === 0; break
      case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
      case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break
      case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
      default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    }
    return dark !== inv
  }))

  // Pick the mask with the lowest penalty (rules 1–4)
  let best: boolean[][] | null = null, bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask != null && mask !== forceMask) continue
    drawFormat(mask)
    const g = masked(mask)
    const s = penalty(g)
    if (s < bestScore) { bestScore = s; best = g }
  }
  return best
}

function penalty(g: boolean[][]): number {
  const n = g.length
  let s = 0
  const lines: boolean[][] = []
  for (let y = 0; y < n; y++) lines.push(g[y])
  for (let x = 0; x < n; x++) lines.push(g.map((r) => r[x]))
  for (const line of lines) {
    // Rule 1: runs of 5+
    let run = 1
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++
      else { if (run >= 5) s += run - 2; run = 1 }
    }
    // Rule 3: finder-like 1:1:3:1:1 with 4 light modules on a side
    const str = line.map((d) => (d ? "1" : "0")).join("")
    for (const pat of ["10111010000", "00001011101"]) {
      for (let k = str.indexOf(pat); k !== -1; k = str.indexOf(pat, k + 1)) s += 40
    }
  }
  // Rule 2: 2x2 blocks
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = g[y][x]
    if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) s += 3
  }
  // Rule 4: dark balance
  const dark = g.reduce((a, r) => a + r.filter(Boolean).length, 0)
  const total = n * n
  s += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10
  return s
}

/** SVG markup (with a 4-module quiet zone) for `text`, or null when it does not fit. */
export function qrSvg(text: string, opts: { size?: number; dark?: string; light?: string } = {}): string | null {
  const g = qrMatrix(text)
  if (!g) return null
  const n = g.length + 8
  let d = ""
  g.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4},${y + 4}h1v1h-1z` }))
  const px = opts.size ?? 192
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${opts.light ?? "#ffffff"}"/><path d="${d}" fill="${opts.dark ?? "#000000"}"/></svg>`
}
