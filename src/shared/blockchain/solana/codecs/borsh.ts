import { PublicKey } from "@solana/web3.js";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class BorshReader {
  private offset = 0;
  private view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    if (!(bytes instanceof Uint8Array)) {
      throw new Error("BorshReader expects Uint8Array input");
    }
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private checkBounds(length: number) {
    if (this.offset + length > this.bytes.byteLength) {
      throw new Error(`BorshReader out of bounds: offset ${this.offset}, reading ${length} bytes, total length ${this.bytes.byteLength}`);
    }
  }

  readU8() {
    this.checkBounds(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readBool() {
    return this.readU8() === 1;
  }

  readU32() {
    this.checkBounds(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readU64() {
    this.checkBounds(8);
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readI64() {
    this.checkBounds(8);
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readPublicKey() {
    this.checkBounds(32);
    const value = this.bytes.slice(this.offset, this.offset + 32);
    this.offset += 32;
    return new PublicKey(value);
  }

  readString() {
    const length = this.readU32();
    this.checkBounds(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return textDecoder.decode(value);
  }
}

export function stripAccountDiscriminator(
  data: Uint8Array,
  discriminator: number[],
  label: string,
) {
  const actual = data.slice(0, discriminator.length);
  const expected = new Uint8Array(discriminator);

  for (let i = 0; i < discriminator.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`Invalid ${label} account discriminator`);
    }
  }

  return data.slice(discriminator.length);
}
