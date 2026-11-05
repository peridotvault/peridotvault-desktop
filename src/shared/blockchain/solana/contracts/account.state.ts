import { PublicKey } from "@solana/web3.js";
import pgc1Idl from "../idl/pgc1.json";
import { BorshReader, stripAccountDiscriminator } from "../codecs/borsh";

export type SvmPgcGameAccount = {
  gameId: string;
  publisher: PublicKey;
  metadataUri: string;
  createdAt: bigint;
  bump: number;
};

export type SvmLicenseAccount = {
  owner: PublicKey;
  game: PublicKey;
  issuedAt: bigint;
  expiresAt: bigint;
  bump: number;
};

function getAccountDiscriminator(idl: any, name: string) {
  const account = idl.accounts?.find((item: any) => item.name === name);
  if (!account) {
    throw new Error(`Missing IDL account discriminator for ${name}`);
  }
  return account.discriminator;
}

export function decodePgcGameAccount(data: Uint8Array): SvmPgcGameAccount {
  const bytes = stripAccountDiscriminator(
    data,
    getAccountDiscriminator(pgc1Idl, "PgcGameAccount"),
    "PgcGameAccount",
  );
  const reader = new BorshReader(bytes);

  return {
    gameId: reader.readString(),
    publisher: reader.readPublicKey(),
    metadataUri: reader.readString(),
    createdAt: reader.readI64(),
    bump: reader.readU8(),
  };
}

export function decodeLicenseAccount(data: Uint8Array): SvmLicenseAccount {
  const bytes = stripAccountDiscriminator(
    data,
    getAccountDiscriminator(pgc1Idl, "LicenseAccount"),
    "LicenseAccount",
  );
  const reader = new BorshReader(bytes);

  return {
    owner: reader.readPublicKey(),
    game: reader.readPublicKey(),
    issuedAt: reader.readI64(),
    expiresAt: reader.readI64(),
    bump: reader.readU8(),
  };
}
