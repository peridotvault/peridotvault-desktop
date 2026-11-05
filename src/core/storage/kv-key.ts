import { appDb } from "./storage.db";

export async function setKvItem<T>(key: string, value: T): Promise<void> {
    await appDb.kv.put({ key, value, updatedAt: Date.now() });
}

export async function getKvItem<T>(key: string): Promise<T | null> {
    const record = await appDb.kv.get(key);
    return (record?.value as T) ?? null;
}

export async function deleteKvItem(key: string): Promise<void> {
    await appDb.kv.delete(key);
}
