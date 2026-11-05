import type {
  Distribution,
  NativeDistribution,
  Platform,
  ViewMode,
  WebDistribution,
} from '@shared/interfaces/game';
import { DraftService } from '@features/game/local-db/services/draft-services';

type WebBuildForm = {
  url: string;
  processor: string;
  graphics: string;
  memory: string;
  storage: string;
  additionalNotes?: string;
};

type HardwareForm = {
  processor: string;
  graphics: string;
  memory: string;
  storage: string;
  additionalNotes: string;
};

const isNativeBuild = (dist: Distribution): dist is { native: NativeDistribution } =>
  'native' in dist;

const isWebBuild = (dist: Distribution): dist is { web: WebDistribution } => 'web' in dist;

export const BuildService = {
  async setLiveVersion(gameId: string, platform: Platform, version: string) {
    const draft = await DraftService.get(gameId);
    if (!draft?.distribution || !draft.gameId) return;

    const updated = draft.distribution.map((dist): Distribution => {
      if (isNativeBuild(dist) && dist.native.os === platform) {
        return { native: { ...dist.native, liveVersion: version } };
      }
      return dist;
    });

    await DraftService.upsertFull({
      ...draft,
      gameId: draft.gameId,
      distribution: updated,
    });
  },

  async saveWebBuild(gameId: string, webBuildForm: WebBuildForm) {
    const draft = await DraftService.get(gameId);
    if (!draft?.gameId) return;

    // Filter out existing web build
    const filtered = (draft.distribution ?? []).filter((dist: Distribution) => !isWebBuild(dist));
    const updated: Distribution[] = [
      ...filtered,
      {
        web: {
          url: webBuildForm.url,
          processor: webBuildForm.processor,
          graphics: webBuildForm.graphics,
          memory: Number(webBuildForm.memory) || 0,
          storage: Number(webBuildForm.storage) || 0,
          additionalNotes:
            webBuildForm.additionalNotes?.trim() ?? undefined,
        },
      },
    ];

    await DraftService.upsertFull({
      ...draft,
      gameId: draft.gameId,
      distribution: updated,
    });
  },

  async handleSaveNativeHardware(
    gameId: string,
    viewMode: ViewMode,
    hardwareForms: Record<Platform, HardwareForm>,
  ) {
    if (viewMode === 'live' || viewMode === 'web') return;

    const draft = await DraftService.get(gameId!);
    if (!draft?.gameId) return;

    const currentForm = hardwareForms[viewMode];

    const updatedDistributions =
      (draft.distribution ?? []).map((dist: Distribution): Distribution => {
        if (isNativeBuild(dist) && dist.native.os === viewMode) {
          return {
            native: {
              ...dist.native,
              processor: currentForm.processor,
              graphics: currentForm.graphics,
              memory: Number(currentForm.memory) || 0,
              storage: Number(currentForm.storage) || 0,
              additionalNotes: currentForm.additionalNotes.trim()
                ? currentForm.additionalNotes.trim()
                : undefined,
            },
          };
        }
        return dist;
      }) || [];

    await DraftService.upsertFull({
      ...draft,
      gameId: draft.gameId,
      distribution: updatedDistributions,
    });
  },
};
