// The part of jsSHA that src/bookmarklet/share-histograms.ts uses.
export default class jsSHA {
    constructor(variant: 'SHA-1', inputFormat: 'ARRAYBUFFER' | 'TEXT' | 'HEX' | 'B64' | 'BYTES' | 'UINT8ARRAY');
    update(input: ArrayBuffer | string | Uint8Array): void;
    getHash(format: 'HEX' | 'B64'): string;
}
