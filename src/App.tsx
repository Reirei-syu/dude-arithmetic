/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Key, type ReactNode, useEffect, useRef, useState } from 'react';
import { AlertCircle, Calculator, Lightbulb, Printer, Settings2, X } from 'lucide-react';
import { cn } from './lib/utils';

const digitOptions = [1, 2, 3, 4, 5];
const operatorOptions = ['+', '-', '×', '÷'];
const columnOptions = [2, 3, 4];
const fontSizeOptions = [16, 20, 24, 28, 32, 36];
const conceptTips = [
  { label: 'A', description: '题目左边的数字，你选择它要有几位数。' },
  { label: '运算', description: '选择 +、-、×、÷ 中的哪一种规则。' },
  { label: 'C', description: '题目右边的数字，你也可以限制它的位数。' },
  { label: 'D', description: '最终答案，系统会保证它不超过你设定的上限。' },
];

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  key?: Key;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'min-w-[5rem] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold transition-all duration-200 active:scale-95 text-base sm:text-lg text-center',
        active
          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 border-transparent'
          : 'bg-white/60 text-gray-700 hover:bg-white/90 border border-white/60 shadow-sm',
      )}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [digitsA, setDigitsA] = useState<number[]>([1, 2]);
  const [operators, setOperators] = useState<string[]>(['+', '-']);
  const [digitsC, setDigitsC] = useState<number[]>([1, 2]);
  const [limitD, setLimitD] = useState<number>(100);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [columns, setColumns] = useState(2);
  const [fontSize, setFontSize] = useState(20);
  const [previewScale, setPreviewScale] = useState(1);
  const [paperScale, setPaperScale] = useState(1);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePaperScale = () => {
      if (!outerContainerRef.current) {
        return;
      }

      const a4WidthPx = 794;
      const a4HeightPx = 1123;
      const styles = window.getComputedStyle(outerContainerRef.current);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availableWidth = outerContainerRef.current.clientWidth - horizontalPadding;
      const availableHeight = outerContainerRef.current.clientHeight - verticalPadding;
      const widthScale = availableWidth / a4WidthPx;
      const heightScale = availableHeight / a4HeightPx;
      const nextScale = Math.min(1, widthScale, heightScale);

      setPaperScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    if (!showPreview) {
      return;
    }

    updatePaperScale();
    window.addEventListener('resize', updatePaperScale);

    return () => window.removeEventListener('resize', updatePaperScale);
  }, [showPreview]);

  useEffect(() => {
    if (!showPreview || !previewContainerRef.current || !previewContentRef.current) {
      return;
    }

    setPreviewScale(1);

    const timer = window.setTimeout(() => {
      if (!previewContainerRef.current || !previewContentRef.current) {
        return;
      }

      const containerHeight = previewContainerRef.current.clientHeight;
      const contentHeight = previewContentRef.current.scrollHeight;

      if (contentHeight > containerHeight) {
        setPreviewScale(containerHeight / contentHeight);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [showPreview, problems, columns, fontSize]);

  const toggleArrayItem = <T,>(arr: T[], setArr: (next: T[]) => void, item: T) => {
    if (arr.includes(item)) {
      setArr(arr.filter((currentItem) => currentItem !== item));
      return;
    }

    setArr([...arr, item]);
  };

  const generateNum = (length: number) => {
    if (length === 1) {
      return Math.floor(Math.random() * 9) + 1;
    }

    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const generateProblems = () => {
    setError('');

    if (digitsA.length === 0 || digitsC.length === 0 || operators.length === 0) {
      setError('请至少选择一个 A 的位数、一个运算符号和一个 C 的位数。');
      return;
    }

    if (!limitD || limitD < 1) {
      setError('请输入有效的答案上限 D（大于 0）。');
      return;
    }

    const minA = Math.pow(10, Math.min(...digitsA) - 1);
    const maxA = Math.pow(10, Math.max(...digitsA)) - 1;
    const minC = Math.pow(10, Math.min(...digitsC) - 1);
    const maxC = Math.pow(10, Math.max(...digitsC)) - 1;

    let possible = false;

    if (operators.includes('+') && minA + minC <= limitD) possible = true;
    if (operators.includes('-') && maxA >= minC) possible = true;
    if (operators.includes('×') && minA * minC <= limitD) possible = true;
    if (operators.includes('÷') && Math.floor(minA / maxC) <= limitD) possible = true;

    if (!possible) {
      setError('根据当前条件无法生成题目，请调大答案上限或选择更小的位数。');
      return;
    }

    const nextProblems: string[] = [];
    let attempts = 0;
    const maxAttempts = 50000;

    while (nextProblems.length < 50 && attempts < maxAttempts) {
      attempts++;

      const operator = operators[Math.floor(Math.random() * operators.length)];
      const lengthA = digitsA[Math.floor(Math.random() * digitsA.length)];
      const lengthC = digitsC[Math.floor(Math.random() * digitsC.length)];

      let a = 0;
      let c = 0;
      let result = 0;

      if (operator === '÷') {
        c = generateNum(lengthC);
        const minALength = Math.pow(10, lengthA - 1);
        const maxALength = Math.pow(10, lengthA) - 1;
        const minResult = Math.ceil(minALength / c);
        const maxResult = Math.floor(maxALength / c);
        const actualMaxResult = Math.min(maxResult, limitD);

        if (minResult > actualMaxResult) {
          continue;
        }

        result = Math.floor(Math.random() * (actualMaxResult - minResult + 1)) + minResult;
        a = c * result;
      } else if (operator === '-') {
        c = generateNum(lengthC);
        const minALength = Math.pow(10, lengthA - 1);
        const maxALength = Math.pow(10, lengthA) - 1;
        const minResult = Math.max(0, minALength - c);
        const maxResult = Math.min(limitD, maxALength - c);

        if (minResult > maxResult) {
          continue;
        }

        result = Math.floor(Math.random() * (maxResult - minResult + 1)) + minResult;
        a = c + result;
      } else if (operator === '+') {
        c = generateNum(lengthC);
        const minALength = Math.pow(10, lengthA - 1);
        const maxALength = Math.pow(10, lengthA) - 1;
        const minResult = minALength + c;
        const maxResult = Math.min(limitD, maxALength + c);

        if (minResult > maxResult) {
          continue;
        }

        result = Math.floor(Math.random() * (maxResult - minResult + 1)) + minResult;
        a = result - c;
      } else if (operator === '×') {
        c = generateNum(lengthC);
        const minALength = Math.pow(10, lengthA - 1);
        const maxALength = Math.pow(10, lengthA) - 1;
        const maxAValue = Math.min(maxALength, Math.floor(limitD / c));

        if (minALength > maxAValue) {
          continue;
        }

        a = Math.floor(Math.random() * (maxAValue - minALength + 1)) + minALength;
        result = a * c;
      } else {
        continue;
      }

      const problem = `${a} ${operator} ${c} = `;

      if (!nextProblems.includes(problem)) {
        nextProblems.push(problem);
      } else if (attempts > maxAttempts / 2) {
        nextProblems.push(problem);
      }
    }

    if (nextProblems.length < 50) {
      setError(`当前条件比较严格，只生成了 ${nextProblems.length} 道题。`);
    }

    setProblems(nextProblems);
    setShowPreview(true);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setError('请允许浏览器弹出新窗口后再打印。');
      return;
    }

    const problemsHtml = problems
      .map(
        (problem, index) => `
      <div class="problem">
        <span class="index">(${index + 1})</span>
        <span class="equation">${problem}</span>
      </div>
    `,
      )
      .join('');

    // 根据字体大小和列数计算合适的行间距（mm单位）
    const rowGapMm = Math.max(1, Math.round((24 - fontSize * 0.5) * 0.26));
    const colGapMm = columns > 2 ? 5 : 10;
    // 根据字体大小计算mm单位的字体
    const fontSizeMm = Math.round(fontSize * 0.26 * 100) / 100;
    const indexFontSizeMm = Math.round(fontSizeMm * 0.8 * 100) / 100;

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>数学练习题 - dude-arithmetic</title>
          <style>
            @page {
              size: A4;
              margin: 12mm 15mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: "Nunito", "Comic Sans MS", "Chalkboard SE", sans-serif;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page {
              width: 180mm;
              max-height: 273mm;
              overflow: hidden;
              margin: 0 auto;
              padding: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 4mm;
            }
            .title {
              font-size: 7mm;
              font-weight: bold;
              margin: 0;
              letter-spacing: 1mm;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-top: 4mm;
              font-size: 4mm;
              border-bottom: 0.5mm solid #000;
              padding-bottom: 2mm;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(${columns}, 1fr);
              column-gap: ${colGapMm}mm;
              row-gap: ${rowGapMm}mm;
              margin-top: 4mm;
            }
            .problem {
              font-size: ${fontSizeMm}mm;
              display: flex;
              align-items: center;
              line-height: 1.3;
              break-inside: avoid;
            }
            .index {
              width: 2.5em;
              text-align: right;
              margin-right: 0.5em;
              color: #666;
              font-size: ${indexFontSizeMm}mm;
              flex-shrink: 0;
            }
            .equation {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              letter-spacing: 0.5mm;
              white-space: nowrap;
            }
            /* 非打印时显示为居中页面 */
            @media screen {
              body {
                background: #f5f5f5;
                display: flex;
                justify-content: center;
                padding: 20px;
              }
              .page {
                background: white;
                padding: 12mm 15mm;
                box-shadow: 0 2px 10px rgba(0,0,0,0.15);
              }
            }
            /* 打印时无额外间距 */
            @media print {
              body { background: none; }
              .page {
                width: 100%;
                max-height: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1 class="title">数学练习题</h1>
              <div class="info-row">
                <span>姓名：__________</span>
                <span>日期：__________</span>
                <span>得分：__________</span>
              </div>
            </div>
            <div class="grid">
              ${problemsHtml}
            </div>
          </div>
          <script>
            // 等待布局完成后自动弹出打印
            window.onload = () => {
              setTimeout(() => window.print(), 400);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 font-sans">
      <div className="no-print max-w-3xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-white/40 backdrop-blur-md rounded-full shadow-sm mb-4">
            <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 drop-shadow-sm">趣味数学题生成器</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-lg">轻松生成 A4 打印版加减乘除练习题</p>
        </div>

        <div className="bg-white/55 backdrop-blur-xl border border-white/70 shadow-lg rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs sm:text-sm font-semibold tracking-[0.18em] text-amber-600 uppercase">首次使用说明</p>
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mt-1">先理解这条规则：A 运算 C = D</h2>
              </div>

              <p className="text-sm sm:text-base text-gray-600 leading-6">
                A 是左边的数字，C 是右边的数字，D 是答案。你先决定 A 和 C 要有几位数，再选择运算符号，并限制 D 的最大值，系统就会自动生成满足条件的题目。
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {conceptTips.map((tip) => (
                  <div key={tip.label} className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-xl bg-blue-100 text-blue-600 font-bold text-sm">
                        {tip.label}
                      </span>
                      <p className="text-sm text-gray-700 leading-5">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/90 px-3 py-3 sm:px-4">
                <p className="text-sm sm:text-base text-blue-900 leading-6">
                  例如：A 选 <span className="font-bold">2 位数</span>，运算选 <span className="font-bold">+</span>，C 选 <span className="font-bold">1 位数</span>，并设置 <span className="font-bold">D ≤ 100</span>，系统就会生成类似
                  <span className="mx-1 inline-block rounded-md bg-white px-2 py-0.5 font-mono text-blue-700 shadow-sm">34 + 5 =</span>
                  这样的题目。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

          <div className="space-y-6 sm:space-y-8 relative z-10">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">A</span>
                数字 A 的位数
              </h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {digitOptions.map((num) => (
                  <ToggleButton key={`a-${num}`} active={digitsA.includes(num)} onClick={() => toggleArrayItem(digitsA, setDigitsA, num)}>
                    {num} 位数
                  </ToggleButton>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">B</span>
                运算符号
              </h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {operatorOptions.map((operator) => (
                  <ToggleButton key={`op-${operator}`} active={operators.includes(operator)} onClick={() => toggleArrayItem(operators, setOperators, operator)}>
                    <span className="text-xl sm:text-2xl leading-none">{operator}</span>
                  </ToggleButton>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-green-100 text-green-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">C</span>
                数字 C 的位数
              </h2>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {digitOptions.map((num) => (
                  <ToggleButton key={`c-${num}`} active={digitsC.includes(num)} onClick={() => toggleArrayItem(digitsC, setDigitsC, num)}>
                    {num} 位数
                  </ToggleButton>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">D</span>
                答案上限 D（≤）
              </h2>
              <input
                type="number"
                value={limitD}
                onChange={(e) => setLimitD(parseInt(e.target.value, 10) || 0)}
                className="w-full md:w-64 px-4 py-3 rounded-xl bg-white/60 border border-white/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg sm:text-xl font-bold text-gray-700"
                min="1"
              />
            </div>

            {error && (
              <div className="bg-red-50/80 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start text-sm sm:text-base">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button
                onClick={generateProblems}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl font-bold text-xl sm:text-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center"
              >
                <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                生成 50 道题目
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="no-print fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl w-full h-[100dvh] sm:h-auto max-w-5xl sm:max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">预览与打印</h3>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto sm:justify-end">
                <button
                  onClick={handlePrint}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center shadow-md shadow-blue-500/20 transition-colors text-sm sm:text-base"
                >
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  打印 A4
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 sm:p-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-center gap-3 sm:gap-4 p-3 sm:px-6 sm:py-3 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-700 font-bold text-sm sm:text-base whitespace-nowrap">排版列数:</span>
                <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
                  {columnOptions.map((value) => (
                    <button
                      key={value}
                      onClick={() => setColumns(value)}
                      className={cn(
                        'px-3 py-1.5 rounded-md font-medium transition-colors text-sm text-center whitespace-nowrap',
                        columns === value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                      )}
                    >
                      {value} 列
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden sm:block w-px h-6 bg-gray-200" />

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-700 font-bold text-sm sm:text-base whitespace-nowrap">字体大小:</span>
                <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5">
                  {fontSizeOptions.map((value) => (
                    <button
                      key={value}
                      onClick={() => setFontSize(value)}
                      className={cn(
                        'px-2 sm:px-3 py-1.5 rounded-md font-medium transition-colors text-xs sm:text-sm text-center',
                        fontSize === value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                      )}
                    >
                      {value}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden sm:flex text-xs sm:text-sm text-gray-400 items-center ml-auto shrink-0">
                <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                若超出将自动缩放适应 A4
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-gray-100 flex justify-center" ref={outerContainerRef}>
              <div style={{ width: `${794 * paperScale}px`, height: `${1123 * paperScale}px`, position: 'relative' }} className="mx-auto flex-shrink-0">
                <div
                  className="bg-white shadow-lg sm:shadow-md absolute top-0 left-0 origin-top-left overflow-hidden rounded-xl sm:rounded-none"
                  style={{ width: '794px', height: '1123px', padding: '45px 56px', boxSizing: 'border-box', transform: `scale(${paperScale})` }}
                >
                  <div ref={previewContainerRef} className="w-full h-full relative">
                    <div ref={previewContentRef} className="w-full origin-top" style={{ transform: `scale(${previewScale})` }}>
                      <div className="text-center mb-4">
                        <h1 className="text-[26px] font-bold text-gray-800 leading-tight">数学练习题</h1>
                        <div className="flex justify-between mt-4 text-base text-gray-600 border-b-2 border-gray-800 pb-2">
                          <span>姓名：__________</span>
                          <span>日期：__________</span>
                          <span>得分：__________</span>
                        </div>
                      </div>

                      <div
                        className="grid mt-4"
                        style={{
                          gridTemplateColumns: `repeat(${columns}, 1fr)`,
                          columnGap: columns > 2 ? '20px' : '40px',
                          rowGap: `${Math.max(4, 24 - fontSize * 0.5)}px`,
                        }}
                      >
                        {problems.map((problem, index) => (
                          <div key={index} className="font-mono flex items-center" style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}>
                            <span className="text-right text-gray-400 font-sans" style={{ width: '2.5em', marginRight: '0.5em', fontSize: '0.8em' }}>
                              ({index + 1})
                            </span>
                            <span className="tracking-widest">{problem}</span>
                          </div>
                        ))}
                      </div>
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
