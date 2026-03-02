// Client-side ML engine: logistic regression (classification) and linear regression (regression)
// All computations use actual dataset values — no placeholders or mock results.

import { ColumnMeta } from './columnTypeDetector';

// Use the same broad type as the store
type DataRow = Record<string, unknown>;

export interface ModelMetrics {
  r2?: number;
  rmse?: number;
  accuracy?: number;
  precision?: Record<string, number>;
  recall?: Record<string, number>;
}

export interface ConfusionMatrixData {
  labels: string[];
  matrix: number[][];
}

export interface FeatureImportance {
  column: string;
  coefficient: number;
  absCoefficient: number;
}

export interface Prediction {
  actual: string | number;
  predicted: string | number;
  probability?: number;
}

export interface ModelResult {
  taskType: 'classification' | 'regression';
  metrics: ModelMetrics;
  confusionMatrix?: ConfusionMatrixData;
  featureImportance: FeatureImportance[];
  predictions: Prediction[];
  targetColumn: string;
  featureColumns: string[];
}

// Matrix operations
function matTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      T[j][i] = A[i][j];
  return T;
}

function matMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
  const C: number[][] = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++)
    for (let j = 0; j < colsB; j++)
      for (let k = 0; k < colsA; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matInverse(A: number[][]): number[][] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null;

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map(row => row.slice(n));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function normalizeFeatures(X: number[][]): { Xn: number[][]; means: number[]; stds: number[] } {
  const n = X.length, m = X[0].length;
  const means = new Array(m).fill(0);
  const stds = new Array(m).fill(1);

  for (let j = 0; j < m; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    means[j] = sum / n;
  }

  for (let j = 0; j < m; j++) {
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (X[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(variance / n) || 1;
  }

  const Xn = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
  return { Xn, means, stds };
}

function gradientDescentLinear(Xb: number[][], y: number[]): number[] {
  const n = Xb.length, m = Xb[0].length;
  const w = new Array(m).fill(0);
  const lr = 0.01;
  const epochs = 500;

  for (let e = 0; e < epochs; e++) {
    const grad = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      const pred = Xb[i].reduce((s, v, j) => s + v * w[j], 0);
      const err = pred - y[i];
      for (let j = 0; j < m; j++) grad[j] += err * Xb[i][j];
    }
    for (let j = 0; j < m; j++) w[j] -= (lr / n) * grad[j];
  }
  return w;
}

function trainLinearRegression(X: number[][], y: number[]): number[] {
  const Xb = X.map(row => [1, ...row]);
  const Xt = matTranspose(Xb);
  const XtX = matMultiply(Xt, Xb);
  const XtXinv = matInverse(XtX);
  if (!XtXinv) {
    return gradientDescentLinear(Xb, y);
  }
  const Xty = Xt.map(row => row.reduce((s, v, i) => s + v * y[i], 0));
  return XtXinv.map(row => row.reduce((s, v, i) => s + v * Xty[i], 0));
}

function trainLogisticRegression(X: number[][], y: number[]): number[] {
  const n = X.length, m = X[0].length;
  const Xb = X.map(row => [1, ...row]);
  const w = new Array(m + 1).fill(0);
  const lr = 0.1;
  const epochs = 300;

  for (let e = 0; e < epochs; e++) {
    const grad = new Array(m + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const z = Xb[i].reduce((s, v, j) => s + v * w[j], 0);
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j <= m; j++) grad[j] += err * Xb[i][j];
    }
    for (let j = 0; j <= m; j++) w[j] -= (lr / n) * grad[j];
  }
  return w;
}

export function detectTaskType(
  rows: DataRow[],
  columnMeta: ColumnMeta[],
  targetColumn: string
): 'classification' | 'regression' {
  const targetMeta = columnMeta.find(c => c.name === targetColumn);
  const targetValues = rows.map(r => r[targetColumn]);
  const uniqueTargetValues = [...new Set(targetValues.map(v => String(v ?? '')))].filter(
    v => v !== '' && v !== 'N/A'
  );

  const firstNonNull = targetValues.find(v => v !== null && v !== undefined && v !== '');
  if (
    targetMeta?.type === 'categorical' ||
    uniqueTargetValues.length <= 10 ||
    isNaN(Number(firstNonNull))
  ) {
    return 'classification';
  }
  return 'regression';
}

export function trainModel(
  rows: DataRow[],
  columnMeta: ColumnMeta[],
  targetColumn: string
): ModelResult {
  const taskType = detectTaskType(rows, columnMeta, targetColumn);

  const featureColumns = columnMeta
    .filter(c => c.name !== targetColumn && c.type === 'numeric')
    .map(c => c.name);

  if (featureColumns.length === 0) {
    return {
      taskType,
      metrics: {},
      featureImportance: [],
      predictions: [],
      targetColumn,
      featureColumns: [],
    };
  }

  const validRows = rows.filter(row => {
    const tv = row[targetColumn];
    if (tv === null || tv === undefined || tv === '' || tv === 'N/A') return false;
    return featureColumns.every(col => {
      const v = row[col];
      return v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
    });
  });

  if (validRows.length < 5) {
    return {
      taskType,
      metrics: {},
      featureImportance: [],
      predictions: [],
      targetColumn,
      featureColumns,
    };
  }

  const X: number[][] = validRows.map(row =>
    featureColumns.map(col => Number(row[col]))
  );

  const { Xn } = normalizeFeatures(X);

  if (taskType === 'regression') {
    const y: number[] = validRows.map(row => Number(row[targetColumn]));
    const weights = trainLinearRegression(Xn, y);

    const Xb = Xn.map(row => [1, ...row]);
    const yPred = Xb.map(row => row.reduce((s, v, j) => s + v * weights[j], 0));

    const yMean = y.reduce((s, v) => s + v, 0) / y.length;
    const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const ssRes = y.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    const rmse = Math.sqrt(ssRes / y.length);

    const featureImportance: FeatureImportance[] = featureColumns
      .map((col, i) => ({
        column: col,
        coefficient: weights[i + 1],
        absCoefficient: Math.abs(weights[i + 1]),
      }))
      .sort((a, b) => b.absCoefficient - a.absCoefficient);

    const predictions: Prediction[] = validRows.map((row, i) => ({
      actual: Number(row[targetColumn]),
      predicted: Math.round(yPred[i] * 1000) / 1000,
    }));

    return {
      taskType: 'regression',
      metrics: {
        r2: Math.round(r2 * 10000) / 10000,
        rmse: Math.round(rmse * 10000) / 10000,
      },
      featureImportance,
      predictions,
      targetColumn,
      featureColumns,
    };
  } else {
    // Classification
    const labelSet = [...new Set(validRows.map(row => String(row[targetColumn])))].sort();
    const labelIndex: Record<string, number> = {};
    labelSet.forEach((l, i) => { labelIndex[l] = i; });

    if (labelSet.length === 2) {
      const y: number[] = validRows.map(row => labelIndex[String(row[targetColumn])]);
      const weights = trainLogisticRegression(Xn, y);

      const Xb = Xn.map(row => [1, ...row]);
      const probs = Xb.map(row => sigmoid(row.reduce((s, v, j) => s + v * weights[j], 0)));
      const yPred = probs.map(p => (p >= 0.5 ? 1 : 0));

      const correct = y.filter((v, i) => v === yPred[i]).length;
      const accuracy = correct / y.length;

      const precision: Record<string, number> = {};
      const recall: Record<string, number> = {};
      labelSet.forEach((label, li) => {
        const tp = y.filter((v, i) => v === li && yPred[i] === li).length;
        const fp = y.filter((v, i) => v !== li && yPred[i] === li).length;
        const fn = y.filter((v, i) => v === li && yPred[i] !== li).length;
        precision[label] = tp + fp === 0 ? 0 : tp / (tp + fp);
        recall[label] = tp + fn === 0 ? 0 : tp / (tp + fn);
      });

      const matrix: number[][] = Array.from({ length: 2 }, () => [0, 0]);
      y.forEach((actual, i) => { matrix[actual][yPred[i]]++; });

      const featureImportance: FeatureImportance[] = featureColumns
        .map((col, i) => ({
          column: col,
          coefficient: weights[i + 1],
          absCoefficient: Math.abs(weights[i + 1]),
        }))
        .sort((a, b) => b.absCoefficient - a.absCoefficient);

      const predictions: Prediction[] = validRows.map((row, i) => ({
        actual: String(row[targetColumn]),
        predicted: labelSet[yPred[i]],
        probability: Math.round(probs[i] * 10000) / 10000,
      }));

      return {
        taskType: 'classification',
        metrics: { accuracy: Math.round(accuracy * 10000) / 10000, precision, recall },
        confusionMatrix: { labels: labelSet, matrix },
        featureImportance,
        predictions,
        targetColumn,
        featureColumns,
      };
    } else {
      // Multi-class: one-vs-rest
      const allWeights: number[][] = [];
      const allProbs: number[][] = validRows.map(() => new Array(labelSet.length).fill(0));

      for (let li = 0; li < labelSet.length; li++) {
        const y: number[] = validRows.map(row =>
          String(row[targetColumn]) === labelSet[li] ? 1 : 0
        );
        const weights = trainLogisticRegression(Xn, y);
        allWeights.push(weights);
        const Xb = Xn.map(row => [1, ...row]);
        Xb.forEach((row, i) => {
          allProbs[i][li] = sigmoid(row.reduce((s, v, j) => s + v * weights[j], 0));
        });
      }

      const yPred = allProbs.map(probs => probs.indexOf(Math.max(...probs)));
      const yActual = validRows.map(row => labelIndex[String(row[targetColumn])]);

      const correct = yActual.filter((v, i) => v === yPred[i]).length;
      const accuracy = correct / yActual.length;

      const precision: Record<string, number> = {};
      const recall: Record<string, number> = {};
      labelSet.forEach((label, li) => {
        const tp = yActual.filter((v, i) => v === li && yPred[i] === li).length;
        const fp = yActual.filter((v, i) => v !== li && yPred[i] === li).length;
        const fn = yActual.filter((v, i) => v === li && yPred[i] !== li).length;
        precision[label] = tp + fp === 0 ? 0 : tp / (tp + fp);
        recall[label] = tp + fn === 0 ? 0 : tp / (tp + fn);
      });

      const matrix: number[][] = Array.from({ length: labelSet.length }, () =>
        new Array(labelSet.length).fill(0)
      );
      yActual.forEach((actual, i) => { matrix[actual][yPred[i]]++; });

      const featureImportance: FeatureImportance[] = featureColumns
        .map((col, fi) => {
          const avgCoef = allWeights.reduce((s, w) => s + w[fi + 1], 0) / allWeights.length;
          return { column: col, coefficient: avgCoef, absCoefficient: Math.abs(avgCoef) };
        })
        .sort((a, b) => b.absCoefficient - a.absCoefficient);

      const predictions: Prediction[] = validRows.map((row, i) => ({
        actual: String(row[targetColumn]),
        predicted: labelSet[yPred[i]],
        probability: Math.round(Math.max(...allProbs[i]) * 10000) / 10000,
      }));

      return {
        taskType: 'classification',
        metrics: { accuracy: Math.round(accuracy * 10000) / 10000, precision, recall },
        confusionMatrix: { labels: labelSet, matrix },
        featureImportance,
        predictions,
        targetColumn,
        featureColumns,
      };
    }
  }
}
