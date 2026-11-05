import type { Gender, UpdateUserInterface, UserInterface } from '@shared/interfaces/user/UserInterface';

const nowNs = (): bigint => BigInt(Date.now()) * 1_000_000n;

const defaultGender: Gender = { other: null };

export async function getUserData({ wallet }: { wallet: any }): Promise<UserInterface> {
  const address = wallet?.runtimeWallet?.evmAddress ?? 'anonymous';
  const createdAt = nowNs();

  return {
    username: address,
    displayName: address,
    email: `${address}@example.com`,
    imageUrl: [],
    backgroundImageUrl: [],
    totalPlaytime: [],
    createdAt,
    userDemographics: {
      birthDate: createdAt,
      gender: defaultGender,
      country: 'ID',
    },
    userInteractions: [],
    userLibraries: [],
    developer: [],
  };
}

export async function getIsUsernameValid(username: string): Promise<
  { ok: null } | { err: { InvalidInput: string } }
> {
  if (!username || username.trim().length < 3) {
    return { err: { InvalidInput: 'Username must be at least 3 characters.' } };
  }
  return { ok: null };
}

export async function updateUser({
  wallet,
  metadataUpdate,
}: {
  wallet: any;
  metadataUpdate: UpdateUserInterface;
}): Promise<UserInterface> {
  const current = await getUserData({ wallet });

  return {
    ...current,
    username: metadataUpdate.username,
    displayName: metadataUpdate.displayName,
    email: metadataUpdate.email,
    imageUrl: metadataUpdate.imageUrl,
    backgroundImageUrl: metadataUpdate.backgroundImageUrl,
    userDemographics: metadataUpdate.userDemographics,
  };
}

export async function createDeveloperProfile({
  wallet,
  websiteUrl,
  bio,
}: {
  wallet: any;
  websiteUrl: string;
  bio: string;
}): Promise<{ ok: true; websiteUrl: string; bio: string; owner: string }> {
  const address = wallet?.runtimeWallet?.evmAddress ?? 'anonymous';
  console.info('createDeveloperProfile stub invoked', { address, websiteUrl, bio });
  return { ok: true, websiteUrl, bio, owner: address };
}
