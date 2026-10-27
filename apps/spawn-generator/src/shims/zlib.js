// node:zlib for the browser bundle, on pako (the same library Lodestone compresses NBT with).

import pako from 'pako'

const bytes = d => (d instanceof Uint8Array ? d : new Uint8Array(d))
export const gzipSync = d => pako.gzip(bytes(d))
export const gunzipSync = d => pako.ungzip(bytes(d))
export const deflateSync = d => pako.deflate(bytes(d))
export const inflateSync = d => pako.inflate(bytes(d))
export const deflateRawSync = d => pako.deflateRaw(bytes(d))
export const inflateRawSync = d => pako.inflateRaw(bytes(d))
export default { gzipSync, gunzipSync, deflateSync, inflateSync, deflateRawSync, inflateRawSync }
