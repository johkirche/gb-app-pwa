/** Where the onboarding's download stands, as every step after it is told. */
export interface DownloadState {
    isSyncing: boolean;
    downloadStarted: boolean;
    downloadComplete: boolean;
    failedCount: number;
    syncError: string | null;
    syncProgress: { phase: string; current: number; total: number };
}
