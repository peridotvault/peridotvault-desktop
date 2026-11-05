import { GameId } from '@shared/interfaces/game';
import { KeyValueRecord } from '@shared/interfaces/kv-key';
import { LibraryEntry } from '@shared/interfaces/library';
import Dexie, { Table } from 'dexie';

class AppDatabase extends Dexie {
  kv!: Table<KeyValueRecord, string>;
  library!: Table<LibraryEntry, GameId>;

  constructor() {
    super('PeridotVaultApp');
    this.version(1).stores({
      kv: '&key, updatedAt',
      library: '&gameId, status, updatedAt, createdAt',
    });
  }
}

export const appDb = new AppDatabase();
