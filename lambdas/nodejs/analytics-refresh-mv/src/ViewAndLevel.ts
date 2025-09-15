
export type ViewAndLevel = {
    mvSchemaName: string;
    mvName: string;
    mvLevel: number;
    incrementalRefreshNotSupported: boolean;
    lastRefreshStartTime?: string;
    lastRefreshStartTimeEpoch: number;
    lastRefreshEndTime?: string;
    lastRefreshEndTimeEpoch: number;
};
