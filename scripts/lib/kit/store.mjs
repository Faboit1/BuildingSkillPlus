// The builder's block store, in sections of 16 x 16 x 16 cells like the game's own chunks: an array
// slot per cell inside a section, a section only where something was placed. It holds as many
// blocks as memory allows (a single JavaScript Map stops at 2^24, about 16.7 million entries, and
// slows down long before that; a 1000-wide spawn island has 30 million) and is several times
// faster than a Map at that size. It has the Map methods the kit uses, by cell key
// (x + X * (z + Z * y)): get, has, set, delete, size, keys, values, entries, iteration.

export class BlockStore {
  constructor([sx, sy, sz]) {
    this.sx = sx
    this.sz = sz
    this.nx = Math.ceil(sx / 16)
    this.nz = Math.ceil(sz / 16)
    this.sections = new Array(this.nx * this.nz * Math.ceil(sy / 16))
    this.count = 0
  }

  get size() {
    return this.count
  }

  // the section index and the cell inside it, for a key
  locate(k) {
    const x = k % this.sx
    const rest = (k - x) / this.sx
    const z = rest % this.sz
    const y = (rest - z) / this.sz
    this.si = (x >> 4) + this.nx * ((z >> 4) + this.nz * (y >> 4))
    return (x & 15) | ((z & 15) << 4) | ((y & 15) << 8)
  }

  get(k) {
    const c = this.locate(k)
    return this.sections[this.si]?.[c]
  }

  has(k) {
    return this.get(k) !== undefined
  }

  set(k, value) {
    const c = this.locate(k)
    let section = this.sections[this.si]
    if (!section) {
      section = new Array(4096).fill(undefined)
      section.n = 0
      this.sections[this.si] = section
    }
    if (section[c] === undefined) {
      section.n += 1
      this.count += 1
    }
    section[c] = value
    return this
  }

  delete(k) {
    const c = this.locate(k)
    const section = this.sections[this.si]
    if (!section || section[c] === undefined) return false
    section[c] = undefined
    section.n -= 1
    this.count -= 1
    if (section.n === 0) this.sections[this.si] = undefined
    return true
  }

  clear() {
    this.sections = new Array(this.sections.length)
    this.count = 0
  }

  *entries() {
    const { nx, nz, sx, sz } = this
    for (let si = 0; si < this.sections.length; si += 1) {
      const section = this.sections[si]
      if (!section) continue
      const bx = (si % nx) * 16
      const rest = (si - (si % nx)) / nx
      const bz = (rest % nz) * 16
      const by = ((rest - (rest % nz)) / nz) * 16
      for (let c = 0; c < 4096; c += 1) {
        const value = section[c]
        if (value === undefined) continue
        yield [bx + (c & 15) + sx * (bz + ((c >> 4) & 15) + sz * (by + (c >> 8))), value]
      }
    }
  }

  *keys() {
    for (const [k] of this.entries()) yield k
  }

  *values() {
    for (const section of this.sections) {
      if (!section) continue
      for (let c = 0; c < 4096; c += 1) if (section[c] !== undefined) yield section[c]
    }
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  // calls fn(key, value) for every cell, without the generator (the hot loops use this)
  each(fn) {
    const { nx, nz, sx, sz } = this
    for (let si = 0; si < this.sections.length; si += 1) {
      const section = this.sections[si]
      if (!section) continue
      const bx = (si % nx) * 16
      const rest = (si - (si % nx)) / nx
      const bz = (rest % nz) * 16
      const by = ((rest - (rest % nz)) / nz) * 16
      for (let c = 0; c < 4096; c += 1) {
        const value = section[c]
        if (value !== undefined) fn(bx + (c & 15) + sx * (bz + ((c >> 4) & 15) + sz * (by + (c >> 8))), value)
      }
    }
  }

  forEach(fn) {
    this.each((k, value) => fn(value, k, this))
  }
}

// A snapshot of the store as [x, y, z, block] entries, taken when it is made: blocks set or removed
// while you loop over it do not change what the loop visits (the old array of entries behaved the
// same). It keeps the keys in a typed array and the blocks by reference, and makes each [x, y, z,
// block] as the loop reaches it, so a snapshot of 20 million blocks costs about 320 MB instead of
// several GB.
export class EntryList {
  constructor(store, sx, sz) {
    const n = store.size
    this.keys = new Float64Array(n)
    this.blocks = new Array(n)
    let i = 0
    store.each((k, block) => {
      this.keys[i] = k
      this.blocks[i] = block
      i += 1
    })
    this.length = i
    this.sx = sx
    this.sz = sz
  }

  at(i) {
    const k = this.keys[i]
    const x = k % this.sx
    const rest = (k - x) / this.sx
    const z = rest % this.sz
    return [x, (rest - z) / this.sz, z, this.blocks[i]]
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i += 1) yield this.at(i)
  }

  forEach(fn) {
    for (let i = 0; i < this.length; i += 1) fn(this.at(i), i)
  }

  filter(fn) {
    const out = []
    for (let i = 0; i < this.length; i += 1) {
      const entry = this.at(i)
      if (fn(entry, i)) out.push(entry)
    }
    return out
  }

  map(fn) {
    const out = new Array(this.length)
    for (let i = 0; i < this.length; i += 1) out[i] = fn(this.at(i), i)
    return out
  }

  some(fn) {
    for (let i = 0; i < this.length; i += 1) if (fn(this.at(i), i)) return true
    return false
  }

  find(fn) {
    for (let i = 0; i < this.length; i += 1) {
      const entry = this.at(i)
      if (fn(entry, i)) return entry
    }
    return undefined
  }
}
