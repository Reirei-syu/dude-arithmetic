/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Key, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Calculator, ChevronLeft, ChevronRight, Lightbulb, Printer, Settings2, Sparkles, X } from 'lucide-react';
import { cn } from './lib/utils';

/* ========================================================================
   TYPES
   ======================================================================== */

type ProblemItem = {
  answer: number;
  id: number;
  displayId: number;
  dayIndex: number;
  left: number;
  operator: string;
  right: number;
};

type FunType = 'guess-op' | 'mixed' | 'compare';

type FunProblem = {
  id: number;
  type: FunType;
  expression: string;   // displayed to user
  answer: string;       // correct answer
  hint: string;         // shown in answer page only
};

/* ========================================================================
   CONSTANTS
   ======================================================================== */

const digitShortcuts = [1, 2, 3];
const operatorOptions = ['+', '-', '×', '÷'];
const columnOptions = [2, 3, 4];
const fontSizeOptions = [16, 20, 24, 28, 32, 36];
const maxProblemsPerBatch = 200;
const defaultProblemsPerBatch = 64;
const STORAGE_KEY = 'dude-arithmetic-v2';

const conceptTips = [
  { label: 'A', description: '题目左边的数字。快捷卡片限制位数，手动模式限制具体数值范围。' },
  { label: '运算', description: '选择 +、-、×、÷ 中的哪一种运算规则。' },
  { label: 'C', description: '题目右边的数字，同样支持快捷卡片或手动范围。' },
  { label: 'D', description: '最终答案，系统会保证它在设定的范围内。' },
];

/* ========================================================================
   HELPERS
   ======================================================================== */

function parseIntSafe(val: string, fallback: number = 0): number {
  if (val === '' || val === '-' || val === '+') return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function generateNumByDigits(length: number): number {
  const absLen = Math.abs(length);
  const isNeg = length < 0;
  if (absLen === 1) { const v = Math.floor(Math.random() * 9) + 1; return isNeg ? -v : v; }
  const min = Math.pow(10, absLen - 1);
  const max = Math.pow(10, absLen) - 1;
  const v = Math.floor(Math.random() * (max - min + 1)) + min;
  return isNeg ? -v : v;
}

function digitValueRange(length: number): { min: number; max: number } {
  const absLen = Math.abs(length);
  const isNeg = length < 0;
  const lo = absLen === 1 ? 1 : Math.pow(10, absLen - 1);
  const hi = Math.pow(10, absLen) - 1;
  return isNeg ? { min: -hi, max: -lo } : { min: lo, max: hi };
}

function overallDigitValueRange(digits: number[]): { min: number; max: number } | null {
  if (digits.length === 0) return null;
  let min = Infinity, max = -Infinity;
  for (const d of digits) {
    const r = digitValueRange(d);
    if (r.min < min) min = r.min;
    if (r.max > max) max = r.max;
  }
  return { min, max };
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseValueRange(from: string, to: string): { min: number; max: number } | null {
  const f = parseIntSafe(from, NaN);
  const t = parseIntSafe(to, NaN);
  if (isNaN(f) || isNaN(t)) return null;
  return { min: Math.min(f, t), max: Math.max(f, t) };
}

function computeAnswer(left: number, op: string, right: number): number {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '×': return left * right;
    case '÷': return right !== 0 ? left / right : NaN;
    default: return NaN;
  }
}

const funTypeLabels: Record<FunType, string> = {
  'guess-op': '猜运算符号',
  'mixed': '混合运算',
  'compare': '比大小',
};

/* ========================================================================
   PAGE METRICS
   ======================================================================== */

function getProblemPageMetrics(columns: number, fontSize: number) {
  const fontSizeMm = Math.round(fontSize * 0.26 * 100) / 100;
  const rowGapMm = Math.max(1, Math.round((24 - fontSize * 0.5) * 0.26));
  const columnGapMm = columns > 2 ? 5 : 10;
  const rowHeightMm = fontSizeMm * 1.35 + rowGapMm;
  const availableGridHeightMm = 273 - 28;
  const rowsPerPage = Math.max(1, Math.floor((availableGridHeightMm + rowGapMm) / rowHeightMm));
  return { columnGapMm, fontSizeMm, itemsPerPage: rowsPerPage * columns, rowGapMm };
}

function getAnswerPageMetrics() {
  const columns = 2;
  const fontSizeMm = 3.8;
  const rowGapMm = 2;
  const rowHeightMm = fontSizeMm * 1.45 + rowGapMm;
  const availableGridHeightMm = 273 - 20;
  const rowsPerPage = Math.max(1, Math.floor((availableGridHeightMm + rowGapMm) / rowHeightMm));
  return { columns, fontSizeMm, itemsPerPage: rowsPerPage * columns, rowGapMm };
}

/* ========================================================================
   UI PRIMITIVES
   ======================================================================== */

function ToggleButton({ active, children, onClick }: { active: boolean; children: ReactNode; key?: Key; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      'min-w-[5rem] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold transition-all duration-200 active:scale-95 text-base sm:text-lg text-center',
      active ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 border-transparent' : 'bg-white/60 text-gray-700 hover:bg-white/90 border border-white/60 shadow-sm',
    )}>{children}</button>
  );
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/* ========================================================================
   BIG INPUT CLASS
   ======================================================================== */

const bigInputClass = 'w-full px-4 py-3 rounded-xl bg-white/60 border border-white/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg sm:text-xl font-bold text-gray-700';

/* ========================================================================
   MODE SWITCH COMPONENT
   ======================================================================== */

function ModeSwitch({ mode, setMode }: { mode: 'shortcut' | 'manual'; setMode: (m: 'shortcut' | 'manual') => void }) {
  return (
    <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5 w-fit">
      <button onClick={() => setMode('shortcut')} className={cn('px-3 py-1.5 rounded-md font-bold transition-colors text-xs sm:text-sm', mode === 'shortcut' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>快捷卡片</button>
      <button onClick={() => setMode('manual')} className={cn('px-3 py-1.5 rounded-md font-bold transition-colors text-xs sm:text-sm', mode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>手动范围</button>
    </div>
  );
}

/* ========================================================================
   APP
   ======================================================================== */

export default function App() {
  /* ---------- standard config ---------- */
  const [aMode, setAMode] = useState<'shortcut' | 'manual'>('shortcut');
  const [digitsAShortcuts, setDigitsAShortcuts] = useState<number[]>([1]);
  const [aValueFrom, setAValueFrom] = useState('');
  const [aValueTo, setAValueTo] = useState('');
  const [operators, setOperators] = useState<string[]>(['+', '-']);
  const [cMode, setCMode] = useState<'shortcut' | 'manual'>('shortcut');
  const [digitsCShortcuts, setDigitsCShortcuts] = useState<number[]>([1]);
  const [cValueFrom, setCValueFrom] = useState('');
  const [cValueTo, setCValueTo] = useState('');
  const [limitDMin, setLimitDMin] = useState('0');
  const [limitDMax, setLimitDMax] = useState('100');
  const [countMode, setCountMode] = useState<'count' | 'days'>('count');
  const [problemCount, setProblemCount] = useState(String(defaultProblemsPerBatch));
  const [days, setDays] = useState('1');
  const [includeAnswerPage, setIncludeAnswerPage] = useState(false);
  const [allowRemainder, setAllowRemainder] = useState(false);

  /* ---------- fun mode config ---------- */
  const [funType, setFunType] = useState<FunType>('guess-op');
  const [funAFrom, setFunAFrom] = useState('1');
  const [funATo, setFunATo] = useState('20');
  const [funCFrom, setFunCFrom] = useState('1');
  const [funCTo, setFunCTo] = useState('20');
  const [funBFrom, setFunBFrom] = useState('1');
  const [funBTo, setFunBTo] = useState('10');
  const [funOp1, setFunOp1] = useState('+');
  const [funOp2, setFunOp2] = useState('×');
  const [funCount, setFunCount] = useState('24');
  const [funIncludeAnswer, setFunIncludeAnswer] = useState(false);

  /* ---------- results ---------- */
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [funProblems, setFunProblems] = useState<FunProblem[]>([]);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<'standard' | 'fun'>('standard');
  const [previewPage, setPreviewPage] = useState(0);

  /* ---------- display options ---------- */
  const [columns, setColumns] = useState(2);
  const [fontSize, setFontSize] = useState(20);
  const [previewScale, setPreviewScale] = useState(1);
  const [paperScale, setPaperScale] = useState(1);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  /* ---------- derived ---------- */

  const aValueRange = useMemo(() => {
    if (aMode === 'manual') return parseValueRange(aValueFrom, aValueTo);
    return overallDigitValueRange(digitsAShortcuts);
  }, [aMode, aValueFrom, aValueTo, digitsAShortcuts]);

  const cValueRange = useMemo(() => {
    if (cMode === 'manual') return parseValueRange(cValueFrom, cValueTo);
    return overallDigitValueRange(digitsCShortcuts);
  }, [cMode, cValueFrom, cValueTo, digitsCShortcuts]);

  const dMin = parseIntSafe(limitDMin, 0);
  const dMax = parseIntSafe(limitDMax, 100);

  const batchSize = useMemo(() => parseIntSafe(problemCount, defaultProblemsPerBatch), [problemCount]);
  const batchCount = useMemo(() => countMode === 'days' ? Math.max(1, parseIntSafe(days, 1)) : 1, [countMode, days]);

  const problemMetrics = getProblemPageMetrics(columns, fontSize);
  const answerMetrics = getAnswerPageMetrics();
  const problemPages = useMemo(() => chunkItems(problems, problemMetrics.itemsPerPage), [problems, problemMetrics.itemsPerPage]);
  const answerPages = useMemo(() => includeAnswerPage ? chunkItems(problems, answerMetrics.itemsPerPage) : [], [includeAnswerPage, problems, answerMetrics.itemsPerPage]);

  /* ---------- localStorage persistence ---------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const c = JSON.parse(saved);
      if (c.aMode) setAMode(c.aMode);
      if (c.digitsAShortcuts) setDigitsAShortcuts(c.digitsAShortcuts);
      if (c.aValueFrom !== undefined) setAValueFrom(c.aValueFrom);
      if (c.aValueTo !== undefined) setAValueTo(c.aValueTo);
      if (c.operators) setOperators(c.operators);
      if (c.cMode) setCMode(c.cMode);
      if (c.digitsCShortcuts) setDigitsCShortcuts(c.digitsCShortcuts);
      if (c.cValueFrom !== undefined) setCValueFrom(c.cValueFrom);
      if (c.cValueTo !== undefined) setCValueTo(c.cValueTo);
      if (c.limitDMin !== undefined) setLimitDMin(c.limitDMin);
      if (c.limitDMax !== undefined) setLimitDMax(c.limitDMax);
      if (c.countMode) setCountMode(c.countMode);
      if (c.problemCount !== undefined) setProblemCount(c.problemCount);
      if (c.days !== undefined) setDays(c.days);
      if (c.includeAnswerPage !== undefined) setIncludeAnswerPage(c.includeAnswerPage);
      if (c.allowRemainder !== undefined) setAllowRemainder(c.allowRemainder);
      if (c.funType) setFunType(c.funType);
      if (c.funAFrom !== undefined) setFunAFrom(c.funAFrom);
      if (c.funATo !== undefined) setFunATo(c.funATo);
      if (c.funCFrom !== undefined) setFunCFrom(c.funCFrom);
      if (c.funCTo !== undefined) setFunCTo(c.funCTo);
      if (c.funBFrom !== undefined) setFunBFrom(c.funBFrom);
      if (c.funBTo !== undefined) setFunBTo(c.funBTo);
      if (c.funOp1) setFunOp1(c.funOp1);
      if (c.funOp2) setFunOp2(c.funOp2);
      if (c.funCount !== undefined) setFunCount(c.funCount);
      if (c.funIncludeAnswer !== undefined) setFunIncludeAnswer(c.funIncludeAnswer);
      if (c.columns) setColumns(c.columns);
      if (c.fontSize) setFontSize(c.fontSize);
    } catch { /* ignore corrupt data */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        aMode, digitsAShortcuts, aValueFrom, aValueTo,
        operators,
        cMode, digitsCShortcuts, cValueFrom, cValueTo,
        limitDMin, limitDMax, countMode, problemCount, days,
        includeAnswerPage, allowRemainder,
        funType, funAFrom, funATo, funCFrom, funCTo, funBFrom, funBTo, funOp1, funOp2, funCount, funIncludeAnswer,
        columns, fontSize,
      }));
    } catch { /* quota exceeded */ }
  }, [aMode, digitsAShortcuts, aValueFrom, aValueTo, operators, cMode, digitsCShortcuts, cValueFrom, cValueTo, limitDMin, limitDMax, countMode, problemCount, days, includeAnswerPage, allowRemainder, funType, funAFrom, funATo, funCFrom, funCTo, funBFrom, funBTo, funOp1, funOp2, funCount, funIncludeAnswer, columns, fontSize]);

  /* ---------- scale effects ---------- */
  useEffect(() => {
    const upd = () => {
      if (!outerContainerRef.current) return;
      const st = window.getComputedStyle(outerContainerRef.current);
      const hPad = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
      const vPad = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
      const aw = outerContainerRef.current.clientWidth - hPad;
      const ah = outerContainerRef.current.clientHeight - vPad;
      const ws = aw / 794, hs = ah / 1123;
      const ns = Math.min(1, ws, hs);
      setPaperScale(Number.isFinite(ns) && ns > 0 ? ns : 1);
    };
    if (!showPreview) return;
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [showPreview]);

  useEffect(() => {
    if (!showPreview || !previewContainerRef.current || !previewContentRef.current) return;
    setPreviewScale(1);
    const t = window.setTimeout(() => {
      if (!previewContainerRef.current || !previewContentRef.current) return;
      const ch = previewContainerRef.current.clientHeight;
      const sh = previewContentRef.current.scrollHeight;
      if (sh > ch) setPreviewScale(ch / sh);
    }, 0);
    return () => window.clearTimeout(t);
  }, [showPreview, columns, fontSize]);

  /* ---------- helpers ---------- */

  const toggleArrayItem = <T,>(arr: T[], setArr: (next: T[]) => void, item: T) => {
    if (arr.includes(item)) setArr(arr.filter((i) => i !== item));
    else setArr([...arr, item]);
  };

  const randomA = useCallback((): number => {
    if (aMode === 'manual') { const r = parseValueRange(aValueFrom, aValueTo); if (!r) return 1; return randomInRange(r.min, r.max); }
    if (digitsAShortcuts.length === 0) return 1;
    return generateNumByDigits(digitsAShortcuts[Math.floor(Math.random() * digitsAShortcuts.length)]);
  }, [aMode, aValueFrom, aValueTo, digitsAShortcuts]);

  const randomC = useCallback((): number => {
    if (cMode === 'manual') { const r = parseValueRange(cValueFrom, cValueTo); if (!r) return 1; return randomInRange(r.min, r.max); }
    if (digitsCShortcuts.length === 0) return 1;
    return generateNumByDigits(digitsCShortcuts[Math.floor(Math.random() * digitsCShortcuts.length)]);
  }, [cMode, cValueFrom, cValueTo, digitsCShortcuts]);

  /* ---------- STANDARD generation ---------- */

  const generateOneBatch = (displayStartId: number, dayIndex: number): ProblemItem[] => {
    const batch: ProblemItem[] = [];
    const seen = new Set<string>();
    let attempts = 0;
    const maxAttempts = Math.max(batchSize * 500, 50000);

    while (batch.length < batchSize && attempts < maxAttempts) {
      attempts++;
      const operator = operators[Math.floor(Math.random() * operators.length)];
      const right = randomC();
      const vrA = aValueRange;
      if (!vrA) continue;

      let left = 0, answer = 0, remainder = 0;

      if (operator === '÷') {
        if (right === 0) continue;
        if (allowRemainder) {
          // generate: left = right * quotient + remainder, remainder ∈ [0, |right|-1]
          const absR = Math.abs(right);
          const ansMin = Math.max(dMin, Math.ceil((vrA.min - (absR - 1)) / right));
          const ansMax = Math.min(dMax, Math.floor((vrA.max + (absR - 1)) / right));
          // normalize for negative right
          const lo = right < 0 ? Math.min(ansMin, ansMax) : ansMin;
          const hi = right < 0 ? Math.max(ansMin, ansMax) : ansMax;
          if (lo > hi) continue;
          const quotient = randomInRange(lo, hi);
          const remMax = absR - 1;
          remainder = remMax > 0 ? Math.floor(Math.random() * remMax) : 0;
          left = right * quotient + remainder;
          answer = left; // store left as answer for display, but we'll use quotient in display
          // Recalculate for validation
          if (left < vrA.min || left > vrA.max) continue;
          answer = quotient;
        } else {
          const a1 = right * dMin, a2 = right * dMax;
          const neededMinA = Math.min(a1, a2), neededMaxA = Math.max(a1, a2);
          const actualMinA = Math.max(vrA.min, neededMinA);
          const actualMaxA = Math.min(vrA.max, neededMaxA);
          if (actualMinA > actualMaxA) continue;
          const ansMin = Math.ceil(actualMinA / right), ansMax = Math.floor(actualMaxA / right);
          const lo = right < 0 ? Math.min(ansMin, ansMax) : ansMin;
          const hi = right < 0 ? Math.max(ansMin, ansMax) : ansMax;
          if (lo > hi) continue;
          answer = randomInRange(lo, hi);
          left = right * answer;
          remainder = 0;
        }
      } else if (operator === '-') {
        const neededMinA = dMin + right, neededMaxA = dMax + right;
        const actualMinA = Math.max(vrA.min, neededMinA);
        const actualMaxA = Math.min(vrA.max, neededMaxA);
        if (actualMinA > actualMaxA) continue;
        left = randomInRange(actualMinA, actualMaxA);
        answer = left - right;
      } else if (operator === '+') {
        const neededMinA = dMin - right, neededMaxA = dMax - right;
        const actualMinA = Math.max(vrA.min, neededMinA);
        const actualMaxA = Math.min(vrA.max, neededMaxA);
        if (actualMinA > actualMaxA) continue;
        left = randomInRange(actualMinA, actualMaxA);
        answer = left + right;
      } else if (operator === '×') {
        if (right === 0) continue;
        const a1 = dMin / right, a2 = dMax / right;
        const neededMinA = Math.ceil(Math.min(a1, a2));
        const neededMaxA = Math.floor(Math.max(a1, a2));
        const actualMinA = Math.max(vrA.min, neededMinA);
        const actualMaxA = Math.min(vrA.max, neededMaxA);
        if (actualMinA > actualMaxA) continue;
        left = randomInRange(actualMinA, actualMaxA);
        answer = left * right;
        if (answer < dMin || answer > dMax) continue;
      } else { continue; }

      const key = `${left}|${operator}|${right}|${remainder}`;
      if (seen.has(key)) continue;
      seen.add(key);

      batch.push({
        answer, dayIndex,
        displayId: displayStartId + batch.length,
        id: dayIndex * maxProblemsPerBatch + displayStartId + batch.length,
        left, operator, right,
      });
    }
    return batch;
  };

  const generateProblems = () => {
    setError('');
    if (!aValueRange) { setError('请设置 A 的有效范围。'); return; }
    if (!cValueRange) { setError('请设置 C 的有效范围。'); return; }
    if (operators.length === 0) { setError('请至少选择一个运算符号。'); return; }
    if (dMin >= dMax) { setError('答案下限 D 必须小于上限。'); return; }
    if (!batchSize || batchSize < 1 || batchSize > maxProblemsPerBatch) { setError(`每份题目数量须在 1 ~ ${maxProblemsPerBatch} 之间。`); return; }
    if (!batchCount || batchCount < 1) { setError('请输入有效的天数。'); return; }

    const vrA = aValueRange, vrC = cValueRange;
    let possible = false;
    if (operators.includes('+') && vrA.min + vrC.min <= dMax && vrA.max + vrC.max >= dMin) possible = true;
    if (operators.includes('-') && vrA.min - vrC.max <= dMax && vrA.max - vrC.min >= dMin) possible = true;
    if (operators.includes('×')) {
      const p = [vrA.min * vrC.min, vrA.min * vrC.max, vrA.max * vrC.min, vrA.max * vrC.max];
      if (Math.min(...p) <= dMax && Math.max(...p) >= dMin) possible = true;
    }
    if (operators.includes('÷') && !(vrC.min <= 0 && vrC.max >= 0)) {
      const sm = vrC.min === 0 ? 1 : vrC.min, sM = vrC.max === 0 ? 1 : vrC.max;
      const q = [vrA.min / sm, vrA.min / sM, vrA.max / sm, vrA.max / sM];
      if (Math.min(...q) <= dMax && Math.max(...q) >= dMin) possible = true;
    }
    if (!possible) { setError('根据当前条件无法生成题目，请调整答案范围或 A/C 的数值范围。'); return; }

    const all: ProblemItem[] = [];
    for (let b = 0; b < batchCount; b++) {
      all.push(...generateOneBatch(1, b));
    }

    if (all.length < batchSize * batchCount) {
      setError(`当前条件比较严格，只生成了 ${all.length} 道题（预期 ${batchSize * batchCount} 题）。`);
    }
    setProblems(all);
    setPreviewType('standard');
    setPreviewPage(0);
    setShowPreview(true);
  };

  /* ---------- FUN generation ---------- */

  const generateFunProblems = () => {
    setError('');
    const rA = parseValueRange(funAFrom, funATo);
    const rC = parseValueRange(funCFrom, funCTo);
    const rB = parseValueRange(funBFrom, funBTo);
    const count = parseIntSafe(funCount, 24);

    if (!rA) { setError('请设置 A 的有效范围。'); return; }
    if (!rC) { setError('请设置 C 的有效范围。'); return; }
    if (funType === 'mixed' && !rB) { setError('请设置 B 的有效范围。'); return; }
    if (!count || count < 1 || count > 100) { setError('题目数量须在 1 ~ 100 之间。'); return; }

    const result: FunProblem[] = [];
    const seen = new Set<string>();
    let attempts = 0;

    while (result.length < count && attempts < 50000) {
      attempts++;

      if (funType === 'guess-op') {
        const a = randomInRange(rA.min, rA.max);
        const c = randomInRange(rC.min, rC.max);
        if (c === 0) continue;
        const op = operatorOptions[Math.floor(Math.random() * operatorOptions.length)];
        const ans = computeAnswer(a, op, c);
        if (!isFinite(ans) || !Number.isInteger(ans)) continue;
        if (ans < -99999 || ans > 99999) continue;
        const key = `${a}|${c}|${ans}|guessop`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: result.length + 1,
          type: 'guess-op',
          expression: `${a}  ___  ${c}  =  ${ans}`,
          answer: op,
          hint: `${a} ${op} ${c} = ${ans}`,
        });
      } else if (funType === 'mixed') {
        const a = randomInRange(rA.min, rA.max);
        const b = randomInRange(rB!.min, rB!.max);
        const c = randomInRange(rC.min, rC.max);
        // × ÷ before + - for display, but compute left-to-right for simplicity
        // Actually: follow standard precedence: ×÷ first, then +-
        const step1 = computeAnswer(b, funOp2, c);
        if (!isFinite(step1) || !Number.isInteger(step1)) continue;
        const ans = computeAnswer(a, funOp1, step1);
        if (!isFinite(ans) || !Number.isInteger(ans)) continue;
        if (ans < -99999 || ans > 99999) continue;
        const key = `${a}|${b}|${c}|${funOp1}|${funOp2}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: result.length + 1,
          type: 'mixed',
          expression: `${a}  ${funOp1}  ${b}  ${funOp2}  ${c}  =  ___`,
          answer: String(ans),
          hint: `${a} ${funOp1} ${b} ${funOp2} ${c} = ${ans}`,
        });
      } else if (funType === 'compare') {
        const a = randomInRange(rA.min, rA.max);
        const c = randomInRange(rC.min, rC.max);
        const op = operatorOptions[Math.floor(Math.random() * operatorOptions.length)];
        let leftVal = computeAnswer(a, op, c);
        if (!isFinite(leftVal) || !Number.isInteger(leftVal) || c === 0) continue;
        // generate D
        const choice = Math.floor(Math.random() * 3);
        let dVal: number;
        let cmp: string;
        if (choice === 0) { dVal = leftVal; cmp = '='; }
        else if (choice === 1) { dVal = leftVal - randomInRange(1, 10); cmp = '>'; }
        else { dVal = leftVal + randomInRange(1, 10); cmp = '<'; }
        const key = `${a}|${op}|${c}|${dVal}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: result.length + 1,
          type: 'compare',
          expression: `${a}  ${op}  ${c}  ___  ${dVal}`,
          answer: cmp,
          hint: `${a} ${op} ${c} = ${leftVal}, ${leftVal} ${cmp} ${dVal}`,
        });
      }
    }

    setFunProblems(result);
    setPreviewType('fun');
    setPreviewPage(0);
    setShowPreview(true);
  };

  /* ---------- STANDARD print ---------- */

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('请允许浏览器弹出新窗口后再打印。'); return; }

    const pages = problemPages;
    const ap = answerPages;

    const pagesHtml = pages.map((pps, pi) => `
      <section class="page">
        <div class="header"><h1 class="title">数学练习题</h1>
          <div class="info-row"><span>姓名：__________</span><span>日期：__________</span><span>第 ${pi + 1} / ${pages.length} 页</span></div>
        </div>
        <div class="problem-grid">${pps.map((p: ProblemItem) => `
          <div class="problem-item"><span class="index">(${p.displayId})</span><span class="equation">${p.left} ${p.operator} ${p.right} = </span></div>`).join('')}</div>
      </section>`).join('');

    const answersHtml = includeAnswerPage ? ap.map((aps, pi) => `
      <section class="page answer-page">
        <div class="header"><h1 class="title">参考答案</h1>
          <div class="info-row answer-info-row"><span>题目页结束后开始打印</span><span>答案页 ${pi + 1} / ${ap.length}</span></div>
        </div>
        <div class="answer-grid">${aps.map((p: ProblemItem) => `
          <div class="answer-item"><span class="index">(${p.displayId})</span><span class="equation">${p.left} ${p.operator} ${p.right} = ${p.answer}</span></div>`).join('')}</div>
      </section>`).join('') : '';

    const css = `@page{size:A4;margin:12mm 15mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Nunito","Comic Sans MS","Chalkboard SE",sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:180mm;min-height:273mm;margin:0 auto;break-after:page}.page:last-child{break-after:auto}.answer-page{break-before:page}.header{text-align:center;margin-bottom:4mm}.title{font-size:7mm;font-weight:bold;letter-spacing:1mm}.info-row{display:flex;justify-content:space-between;margin-top:4mm;font-size:4mm;border-bottom:.5mm solid #000;padding-bottom:2mm}.problem-grid{display:grid;grid-template-columns:repeat(${columns},1fr);column-gap:${problemMetrics.columnGapMm}mm;row-gap:${problemMetrics.rowGapMm}mm;margin-top:4mm}.problem-item{font-size:${problemMetrics.fontSizeMm}mm;display:flex;align-items:center;line-height:1.3;break-inside:avoid}.answer-grid{display:grid;grid-template-columns:repeat(${answerMetrics.columns},1fr);column-gap:8mm;row-gap:${answerMetrics.rowGapMm}mm;margin-top:4mm}.answer-item{font-size:${answerMetrics.fontSizeMm}mm;display:flex;align-items:center;line-height:1.45;break-inside:avoid}.index{width:2.8em;text-align:right;margin-right:.5em;color:#666;flex-shrink:0}.equation{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:nowrap;letter-spacing:.5mm}@media screen{body{background:#f5f5f5;padding:20px}.page{background:#fff;padding:12mm 15mm;box-shadow:0 2px 10px rgba(0,0,0,.15);margin-bottom:20px}}`;

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>数学练习题</title><style>${css}</style></head><body>${pagesHtml}${answersHtml}<script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script></body></html>`);
    printWindow.document.close();
  };

  /* ---------- FUN print ---------- */

  const handleFunPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('请允许浏览器弹出新窗口后再打印。'); return; }

    const itemPerPage = 12;
    const pages = chunkItems(funProblems, itemPerPage);
    const label = funTypeLabels[funType];

    const answersForPrint = funProblems.map((p, i) => `(${i + 1}) ${p.hint}`).join('<br>');

    const pagesHtml = pages.map((pps, pi) => `
      <section class="page">
        <div class="header"><h1 class="title">趣味数学 - ${label}</h1>
          <div class="info-row"><span>姓名：__________</span><span>日期：__________</span><span>第 ${pi + 1} / ${pages.length} 页</span></div>
        </div>
        <div class="fun-grid">${pps.map((p: FunProblem) => `
          <div class="fun-item"><span class="index">(${p.id})</span><span class="equation">${p.expression}</span></div>`).join('')}</div>
      </section>`).join('');

    const answersHtml = funIncludeAnswer ? `
      <section class="page answer-page">
        <div class="header"><h1 class="title">趣味数学 - 答案</h1>
          <div class="info-row answer-info-row"><span>答案页</span></div>
        </div>
        <div class="fun-answer">${answersForPrint}</div>
      </section>` : '';

    const css = `@page{size:A4;margin:12mm 15mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Nunito","Comic Sans MS","Chalkboard SE",sans-serif;color:#000;}.page{width:180mm;min-height:273mm;margin:0 auto;break-after:page}.page:last-child{break-after:auto}.answer-page{break-before:page}.header{text-align:center;margin-bottom:6mm}.title{font-size:7mm;font-weight:bold;letter-spacing:1mm}.info-row{display:flex;justify-content:space-between;margin-top:4mm;font-size:4mm;border-bottom:.5mm solid #000;padding-bottom:2mm}.fun-grid{display:flex;flex-direction:column;gap:6mm;margin-top:6mm;font-size:6mm}.fun-item{display:flex;align-items:center;line-height:1.6;break-inside:avoid}.index{width:3em;text-align:right;margin-right:.8em;color:#666;flex-shrink:0;font-size:.75em}.equation{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:nowrap;letter-spacing:1mm}.fun-answer{font-size:4.5mm;line-height:2;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;margin-top:4mm}@media screen{body{background:#f5f5f5;padding:20px}.page{background:#fff;padding:12mm 15mm;box-shadow:0 2px 10px rgba(0,0,0,.15);margin-bottom:20px}}`;

    printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>趣味数学</title><style>${css}</style></head><body>${pagesHtml}${answersHtml}<script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script></body></html>`);
    printWindow.document.close();
  };

  /* ---------- render ---------- */

  const formatExpression = (p: ProblemItem) => `${p.left} ${p.operator} ${p.right} = `;
  const formatAnswer = (p: ProblemItem) => `${p.left} ${p.operator} ${p.right} = ${p.answer}`;

  const currentPreviewProblems = previewType === 'standard'
    ? (problemPages[previewPage] ?? [])
    : [];
  const currentPreviewFunProblems = previewType === 'fun'
    ? funProblems
    : [];
  const funPages = useMemo(() => chunkItems(funProblems, 12), [funProblems]);
  const currentFunPage = funPages[previewPage] ?? [];

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 font-sans">
      <div className="no-print max-w-3xl mx-auto">
        {/* header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-white/40 backdrop-blur-md rounded-full shadow-sm mb-4">
            <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 drop-shadow-sm">趣味数学题生成器</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-lg">轻松生成 A4 打印版加减乘除练习题</p>
        </div>

        {/* intro */}
        <div className="bg-white/55 backdrop-blur-xl border border-white/70 shadow-lg rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs sm:text-sm font-semibold tracking-[0.18em] text-amber-600 uppercase">使用说明</p>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mt-1">先理解这条规则：A 运算 C = D</h2>
              </div>
              <p className="text-sm sm:text-base text-gray-600 leading-6">
                A 是左边的数字，C 是右边的数字，D 是答案。快捷卡片限制 A/C 的位数，手动范围限制 A/C 的具体数值。配置会自动保存，下次打开无需重新设置。
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {conceptTips.map((tip) => (
                  <div key={tip.label} className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-xl bg-blue-100 text-blue-600 font-bold text-sm">{tip.label}</span>
                      <p className="text-sm text-gray-700 leading-5">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* === STANDARD CONFIG === */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />

          <div className="space-y-6 sm:space-y-8 relative z-10">
            {/* A */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">A</span>数字 A
              </h2>
              <ModeSwitch mode={aMode} setMode={setAMode} />
              {aMode === 'shortcut' ? (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {digitShortcuts.map((num) => (
                      <ToggleButton key={`a-${num}`} active={digitsAShortcuts.includes(num)} onClick={() => toggleArrayItem(digitsAShortcuts, setDigitsAShortcuts, num)}>{num} 位数</ToggleButton>
                    ))}
                  </div>
                  {aValueRange && <p className="mt-1 text-xs text-gray-400">当前范围: {aValueRange.min} ~ {aValueRange.max}</p>}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <input type="number" value={aValueFrom} onChange={(e) => setAValueFrom(e.target.value)} placeholder="最小值" className={bigInputClass + ' w-32 sm:w-36'} />
                  <span className="text-gray-400 font-bold text-lg">~</span>
                  <input type="number" value={aValueTo} onChange={(e) => setAValueTo(e.target.value)} placeholder="最大值" className={bigInputClass + ' w-32 sm:w-36'} />
                  {aValueRange && <span className="text-xs text-gray-400 ml-1">范围: {aValueRange.min} ~ {aValueRange.max}</span>}
                </div>
              )}
            </div>

            {/* 运算符 */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">B</span>运算符号
              </h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {operatorOptions.map((op) => (
                  <ToggleButton key={`op-${op}`} active={operators.includes(op)} onClick={() => toggleArrayItem(operators, setOperators, op)}><span className="text-xl sm:text-2xl leading-none">{op}</span></ToggleButton>
                ))}
              </div>
            </div>

            {/* C */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-green-100 text-green-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">C</span>数字 C
              </h2>
              <ModeSwitch mode={cMode} setMode={setCMode} />
              {cMode === 'shortcut' ? (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {digitShortcuts.map((num) => (
                      <ToggleButton key={`c-${num}`} active={digitsCShortcuts.includes(num)} onClick={() => toggleArrayItem(digitsCShortcuts, setDigitsCShortcuts, num)}>{num} 位数</ToggleButton>
                    ))}
                  </div>
                  {cValueRange && <p className="mt-1 text-xs text-gray-400">当前范围: {cValueRange.min} ~ {cValueRange.max}</p>}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <input type="number" value={cValueFrom} onChange={(e) => setCValueFrom(e.target.value)} placeholder="最小值" className={bigInputClass + ' w-32 sm:w-36'} />
                  <span className="text-gray-400 font-bold text-lg">~</span>
                  <input type="number" value={cValueTo} onChange={(e) => setCValueTo(e.target.value)} placeholder="最大值" className={bigInputClass + ' w-32 sm:w-36'} />
                  {cValueRange && <span className="text-xs text-gray-400 ml-1">范围: {cValueRange.min} ~ {cValueRange.max}</span>}
                </div>
              )}
            </div>

            {/* D */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">D</span>答案 D 的范围
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" value={limitDMin} onChange={(e) => setLimitDMin(e.target.value)} placeholder="下限" className={bigInputClass + ' w-32 sm:w-36'} />
                <span className="text-gray-500 font-bold text-lg">≤ D ≤</span>
                <input type="number" value={limitDMax} onChange={(e) => setLimitDMax(e.target.value)} placeholder="上限" className={bigInputClass + ' w-32 sm:w-36'} />
              </div>
              <p className="mt-1 text-xs text-gray-400">支持负数，下限必须小于上限</p>
            </div>

            {/* 除法余数 */}
            <div>
              <label className="flex items-start sm:items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 shadow-sm cursor-pointer">
                <input type="checkbox" checked={allowRemainder} onChange={(e) => setAllowRemainder(e.target.checked)} className="mt-1 sm:mt-0 h-5 w-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
                <div><p className="font-bold text-gray-800">除法允许有余数</p><p className="text-sm text-gray-500 mt-1">开启后，除法题可能产生余数（如 14 ÷ 3 = 4…2）。</p></div>
              </label>
            </div>

            {/* 出题数量 */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">E</span>出题数量
              </h2>
              <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5 w-fit mb-3">
                <button onClick={() => setCountMode('count')} className={cn('px-4 py-2 rounded-md font-bold transition-colors text-xs sm:text-sm', countMode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>题目数量</button>
                <button onClick={() => setCountMode('days')} className={cn('px-4 py-2 rounded-md font-bold transition-colors text-xs sm:text-sm', countMode === 'days' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>练习天数</button>
              </div>
              {countMode === 'count' ? (
                <div>
                  <input type="number" value={problemCount} onChange={(e) => setProblemCount(e.target.value)} placeholder={String(defaultProblemsPerBatch)} className={bigInputClass + ' max-w-xs'} min="1" max={maxProblemsPerBatch} />
                  <p className="mt-2 text-sm text-gray-500">支持 1 ~ {maxProblemsPerBatch} 题。</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder="1" className={bigInputClass + ' w-24 sm:w-28'} min="1" />
                    <span className="text-gray-600 font-bold">天</span>
                    <span className="text-gray-500">×</span>
                    <input type="number" value={problemCount} onChange={(e) => setProblemCount(e.target.value)} placeholder={String(defaultProblemsPerBatch)} className={bigInputClass + ' w-24 sm:w-28'} min="1" max={maxProblemsPerBatch} />
                    <span className="text-gray-500">题/天</span>
                    <span className="text-blue-600 font-bold">= {batchSize * batchCount} 题</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{batchCount} 天独立随机生成，每份上限 {maxProblemsPerBatch} 题。</p>
                </div>
              )}
            </div>

            {/* 打印设置 */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-teal-100 text-teal-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">F</span>打印设置
              </h2>
              <label className="flex items-start sm:items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-4 shadow-sm cursor-pointer">
                <input type="checkbox" checked={includeAnswerPage} onChange={(e) => setIncludeAnswerPage(e.target.checked)} className="mt-1 sm:mt-0 h-5 w-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
                <div><p className="font-bold text-gray-800">打印独立答案页</p><p className="text-sm text-gray-500 mt-1">开启后，答案独立分页，不和题目混排。</p></div>
              </label>
            </div>

            {/* generate */}
            {error && (
              <div className="bg-red-50/80 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start text-sm sm:text-base">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" /><p>{error}</p>
              </div>
            )}
            <div className="pt-4">
              <button onClick={generateProblems} className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl font-bold text-xl sm:text-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center">
                <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />生成题目
              </button>
            </div>
          </div>
        </div>

        {/* === 更多趣味 === */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-pink-400/10 rounded-full blur-3xl -mr-10 -mb-10 pointer-events-none" />

          <div className="space-y-5 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">更多趣味</h2>
            </div>

            {/* fun type selector */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5 w-full sm:w-fit flex-wrap">
              {(Object.keys(funTypeLabels) as FunType[]).map((t) => (
                <button key={t} onClick={() => setFunType(t)} className={cn('px-3 sm:px-4 py-2 rounded-md font-bold transition-colors text-xs sm:text-sm', funType === t ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>{funTypeLabels[t]}</button>
              ))}
            </div>

            {/* fun config */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm font-bold text-gray-600">数字 A 范围</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" value={funAFrom} onChange={(e) => setFunAFrom(e.target.value)} placeholder="1" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                  <span className="text-gray-400">~</span>
                  <input type="number" value={funATo} onChange={(e) => setFunATo(e.target.value)} placeholder="20" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                </div>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-600">数字 C 范围</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" value={funCFrom} onChange={(e) => setFunCFrom(e.target.value)} placeholder="1" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                  <span className="text-gray-400">~</span>
                  <input type="number" value={funCTo} onChange={(e) => setFunCTo(e.target.value)} placeholder="20" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                </div>
              </div>
            </div>

            {funType === 'mixed' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-sm font-bold text-gray-600">数字 B 范围</span>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" value={funBFrom} onChange={(e) => setFunBFrom(e.target.value)} placeholder="1" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                      <span className="text-gray-400">~</span>
                      <input type="number" value={funBTo} onChange={(e) => setFunBTo(e.target.value)} placeholder="10" className={bigInputClass + ' w-24 sm:w-28 text-base'} />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-600">运算符号</span>
                    <div className="flex items-center gap-2 mt-1">
                      <select value={funOp1} onChange={(e) => setFunOp1(e.target.value)} className="px-3 py-2 rounded-xl bg-white/60 border border-white/60 font-bold text-lg">{operatorOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      <span className="text-gray-400">+</span>
                      <select value={funOp2} onChange={(e) => setFunOp2(e.target.value)} className="px-3 py-2 rounded-xl bg-white/60 border border-white/60 font-bold text-lg">{operatorOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">先算第二个符号（B ○ C），再算第一个（A ○ 结果）</p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-sm font-bold text-gray-600">题目数量</span>
                <input type="number" value={funCount} onChange={(e) => setFunCount(e.target.value)} placeholder="24" className={bigInputClass + ' w-24 sm:w-28 text-base mt-1'} min="1" max="100" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input type="checkbox" checked={funIncludeAnswer} onChange={(e) => setFunIncludeAnswer(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
                <span className="text-sm text-gray-700 font-bold">打印答案页</span>
              </label>
            </div>

            <button onClick={generateFunProblems} className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-amber-400 to-pink-400 hover:from-amber-500 hover:to-pink-500 text-white rounded-2xl font-bold text-lg sm:text-xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] flex items-center justify-center">
              <Sparkles className="w-5 h-5 mr-2" />生成趣味题目
            </button>
          </div>
        </div>
      </div>

      {/* === PREVIEW MODAL === */}
      {showPreview && (
        <div className="no-print fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl w-full h-[100dvh] sm:h-auto max-w-5xl sm:max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                  {previewType === 'standard' ? '预览与打印' : `趣味数学 - ${funTypeLabels[funType]}`}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {previewType === 'standard'
                    ? `题目页 ${Math.max(problemPages.length, 1)} 页${includeAnswerPage ? `，答案页 ${Math.max(answerPages.length, 1)} 页` : ''}`
                    : `共 ${funProblems.length} 题`}
                  {previewType === 'standard' && problemPages.length > 1 && ` | 当前第 ${previewPage + 1} 页`}
                  {previewType === 'fun' && funPages.length > 1 && ` | 当前第 ${previewPage + 1} 页`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {previewType === 'standard' && problemPages.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => setPreviewPage((p) => Math.max(0, p - 1))} disabled={previewPage === 0} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-bold text-gray-600 w-16 text-center">{previewPage + 1}/{problemPages.length}</span>
                    <button onClick={() => setPreviewPage((p) => Math.min(problemPages.length - 1, p + 1))} disabled={previewPage >= problemPages.length - 1} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                {previewType === 'fun' && funPages.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => setPreviewPage((p) => Math.max(0, p - 1))} disabled={previewPage === 0} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-bold text-gray-600 w-16 text-center">{previewPage + 1}/{funPages.length}</span>
                    <button onClick={() => setPreviewPage((p) => Math.min(funPages.length - 1, p + 1))} disabled={previewPage >= funPages.length - 1} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                )}
                <button onClick={previewType === 'standard' ? handlePrint : handleFunPrint} className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center shadow-md text-sm sm:text-base"><Printer className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />打印</button>
                <button onClick={() => setShowPreview(false)} className="p-2 sm:p-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-gray-100 flex justify-center" ref={outerContainerRef}>
              <div style={{ width: `${794 * paperScale}px`, height: `${1123 * paperScale}px`, position: 'relative' }} className="mx-auto flex-shrink-0">
                <div className="bg-white shadow-lg sm:shadow-md absolute top-0 left-0 origin-top-left overflow-hidden rounded-xl sm:rounded-none"
                  style={{ width: '794px', height: '1123px', padding: '45px 56px', boxSizing: 'border-box', transform: `scale(${paperScale})` }}>
                  <div ref={previewContainerRef} className="w-full h-full relative">
                    <div ref={previewContentRef} className="w-full origin-top" style={{ transform: `scale(${previewScale})` }}>
                      {previewType === 'standard' && (
                        <>
                          <div className="text-center mb-4">
                            <h1 className="text-[26px] font-bold text-gray-800 leading-tight">数学练习题</h1>
                            <div className="flex justify-between mt-4 text-base text-gray-600 border-b-2 border-gray-800 pb-2">
                              <span>姓名：__________</span><span>日期：__________</span><span>第 {previewPage + 1} / {Math.max(problemPages.length, 1)} 页</span>
                            </div>
                          </div>
                          <div className="grid mt-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, columnGap: columns > 2 ? '20px' : '40px', rowGap: `${Math.max(4, 24 - fontSize * 0.5)}px` }}>
                            {currentPreviewProblems.map((p) => (
                              <div key={p.id} className="font-mono flex items-center" style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}>
                                <span className="text-right text-gray-400 font-sans" style={{ width: '2.5em', marginRight: '0.5em', fontSize: '0.8em' }}>({p.displayId})</span>
                                <span className="tracking-widest">{formatExpression(p)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {previewType === 'fun' && (
                        <div>
                          <div className="text-center mb-4">
                            <h1 className="text-[26px] font-bold text-gray-800 leading-tight">趣味数学 - {funTypeLabels[funType]}</h1>
                            <div className="flex justify-between mt-4 text-base text-gray-600 border-b-2 border-gray-800 pb-2">
                              <span>姓名：__________</span><span>日期：__________</span>
                              <span>第 {previewPage + 1} / {Math.max(funPages.length, 1)} 页</span>
                            </div>
                          </div>
                          <div className="mt-4 space-y-4">
                            {currentFunPage.map((p) => (
                              <div key={p.id} className="font-mono flex items-center text-xl" style={{ lineHeight: 2 }}>
                                <span className="text-right text-gray-400 font-sans mr-3" style={{ width: '2em', fontSize: '0.75em' }}>({p.id})</span>
                                <span className="tracking-widest">{p.expression}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
