import { getCurrentWebviewWindowSafe, isTauriRuntime } from './runtime';

type LoginWindowStage = 'updater' | 'login';

export const isDesktopRuntime = () => isTauriRuntime();

const closeCurrentWindow = async () => {
  const currentWindow = await getCurrentWebviewWindowSafe();
  try {
    await currentWindow?.close();
  } catch (error) {
    console.warn('[windowControls] Failed to close current window', error);
  }
};

export const showMainWindow = async () => {
  if (!isDesktopRuntime()) return;
  try {
    const currentWindow = await getCurrentWebviewWindowSafe();
    if (currentWindow?.label === 'main') return;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_main_window');
    await closeCurrentWindow();
  } catch (error) {
    console.warn('[windowControls] Failed to open main window', error);
  }
};

export const showLoginWindow = async (targetStage?: LoginWindowStage) => {
  if (!isDesktopRuntime()) return;
  try {
    const currentWindow = await getCurrentWebviewWindowSafe();
    if (currentWindow?.label === 'login') return;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_login_window', { stage: targetStage });
    await closeCurrentWindow();
  } catch (error) {
    console.warn('[windowControls] Failed to open login window', error);
  }
};

export const redirectToLogin = (stage: LoginWindowStage = 'login') => {
  if (isDesktopRuntime()) {
    void showLoginWindow(stage);
    return;
  }
  if (typeof window !== 'undefined') {
    const hash = stage === 'updater' ? '#/updater' : '';
    window.location.assign(`/login.html${hash}`);
  }
};

export const redirectToMain = () => {
  if (isDesktopRuntime()) {
    void showMainWindow();
    return;
  }
  if (typeof window !== 'undefined') {
    window.location.assign('/');
  }
};
