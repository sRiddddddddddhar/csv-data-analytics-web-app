import { create } from 'zustand';
import { ColumnMeta } from '../utils/columnTypeDetector';
import { CleaningSummary } from '../utils/dataCleanser';

export type DataRow = Record<string, unknown>;

export interface DataStore {
  filename: string | null;
  rawData: Record<string, string>[];
  cleanedData: DataRow[];
  columns: ColumnMeta[];
  cleaningSummary: CleaningSummary | null;
  setDataset: (
    filename: string,
    rawData: Record<string, string>[],
    cleanedData: DataRow[],
    columns: ColumnMeta[],
    cleaningSummary: CleaningSummary
  ) => void;
  clearDataset: () => void;
}

export const useDataStore = create<DataStore>((set) => ({
  filename: null,
  rawData: [],
  cleanedData: [],
  columns: [],
  cleaningSummary: null,
  setDataset: (filename, rawData, cleanedData, columns, cleaningSummary) =>
    set({ filename, rawData, cleanedData, columns, cleaningSummary }),
  clearDataset: () =>
    set({ filename: null, rawData: [], cleanedData: [], columns: [], cleaningSummary: null }),
}));
