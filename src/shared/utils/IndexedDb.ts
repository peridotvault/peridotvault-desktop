import { UserInterface } from '@shared/interfaces/user/UserInterface';
import { KV_KEYS } from '@shared/database/kv-keys';
import { getKvItem, setKvItem } from '@core/storage/kv-key';

// ✅ User
export async function saveUserInfo(user: UserInterface) {
  try {
    await setKvItem(KV_KEYS.userInfo, user);
  } catch (error) {
    console.error('Failed to save user info', error);
  }
}

export async function getUserInfo(): Promise<UserInterface | null> {
  return (await getKvItem<UserInterface>(KV_KEYS.userInfo)) ?? null;
}

// Currency (Generic stored settings)
export async function getCurrency(): Promise<any[] | null> {
  return (await getKvItem<any[]>(KV_KEYS.currencies)) ?? null;
}

export async function saveCurrency(currencies: any[]) {
  try {
    await setKvItem(KV_KEYS.currencies, currencies);
  } catch (error) {
    console.error('Failed to save currencies', error);
  }
}
