/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Printer, Settings2, AlertCircle, X, Calculator } from 'lucide-react';
import { cn } from './lib/utils';

const ToggleButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: ReactNode, key?: string | number }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl font-bold transition-all duration-200 active:scale-95 text-lg",
      active 
        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 border-transparent" 
        : "bg-white/60 text-gray-700 hover:bg-white/90 border border-white/60 shadow-sm"
    )}
  >
    {children}
  </button>
);

export default function App() {
  const [digitsA, setDigitsA] = useState<number[]>([1, 2]);
  const [operators, setOperators] = useState<string[]>(['+', '-']);
  const [digitsC, setDigitsC] = useState<number[]>([1, 2]);
  const [limitD, setLimitD] = useState<number>(100);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  
  const [columns, setColumns] = useState<number>(2);
  const [fontSize, setFontSize] = useState<number>(20);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [paperScale, setPaperScale] = useState<number>(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePaperScale = () => {
      if (outerContainerRef.current) {
        const containerWidth = outerContainerRef.current.clientWidth;
        const padding = 32; // 16px padding on each side (p-4)
        const availableWidth = containerWidth - padding;
        const a4WidthPx = 794; // 210mm in pixels
        if (availableWidth < a4WidthPx) {
          setPaperScale(availableWidth / a4WidthPx);
        } else {
          setPaperScale(1);
        }
      }
    };

    if (showPreview) {
      updatePaperScale();
      window.addEventListener('resize', updatePaperScale);
      return () => window.removeEventListener('resize', updatePaperScale);
    }
  }, [showPreview]);

  useEffect(() => {
    if (showPreview && previewContainerRef.current && previewContentRef.current) {
      setPreviewScale(1);
      setTimeout(() => {
        if (previewContainerRef.current && previewContentRef.current) {
          const containerHeight = previewContainerRef.current.clientHeight;
          const contentHeight = previewContentRef.current.scrollHeight;
          if (contentHeight > containerHeight) {
            setPreviewScale(containerHeight / contentHeight);
          }
        }
      }, 0);
    }
  }, [showPreview, problems, columns, fontSize]);

  const toggleArrayItem = (arr: any[], setArr: any, item: any) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i: any) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const generateProblems = () => {
    setError('');
    if (digitsA.length === 0 || digitsC.length === 0 || operators.length === 0) {
      setError('请至少选择一个A的位数、一个运算符号和一个C的位数！');
      return;
    }
    if (!limitD || limitD < 1) {
      setError('请输入有效的答案上限D（大于0）！');
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
      setError('哎呀！根据您选择的条件，无法生成任何题目。请尝试调大答案上限或选择较小的位数。');
      return;
    }

    const newProblems: string[] = [];
    let attempts = 0;
    const maxAttempts = 50000;

    const generateNum = (len: number) => {
      if (len === 1) return Math.floor(Math.random() * 9) + 1;
      const min = Math.pow(10, len - 1);
      const max = Math.pow(10, len) - 1;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    while (newProblems.length < 50 && attempts < maxAttempts) {
      attempts++;
      const op = operators[Math.floor(Math.random() * operators.length)];
      const lenA = digitsA[Math.floor(Math.random() * digitsA.length)];
      const lenC = digitsC[Math.floor(Math.random() * digitsC.length)];

      let a, c, res;

      if (op === '÷') {
        c = generateNum(lenC);
        const minA_len = Math.pow(10, lenA - 1);
        const maxA_len = Math.pow(10, lenA) - 1;
        
        const minRes = Math.ceil(minA_len / c);
        const maxRes = Math.floor(maxA_len / c);
        const actualMaxRes = Math.min(maxRes, limitD);
        
        if (minRes > actualMaxRes) continue;
        
        res = Math.floor(Math.random() * (actualMaxRes - minRes + 1)) + minRes;
        a = c * res;
      } else if (op === '-') {
        c = generateNum(lenC);
        const minA_len = Math.pow(10, lenA - 1);
        const maxA_len = Math.pow(10, lenA) - 1;
        
        const minRes = Math.max(0, minA_len - c);
        const maxRes = Math.min(limitD, maxA_len - c);
        
        if (minRes > maxRes) continue;
        
        res = Math.floor(Math.random() * (maxRes - minRes + 1)) + minRes;
        a = c + res;
      } else if (op === '+') {
        c = generateNum(lenC);
        const minA_len = Math.pow(10, lenA - 1);
        const maxA_len = Math.pow(10, lenA) - 1;
        
        const minRes = minA_len + c;
        const maxRes = Math.min(limitD, maxA_len + c);
        
        if (minRes > maxRes) continue;
        
        res = Math.floor(Math.random() * (maxRes - minRes + 1)) + minRes;
        a = res - c;
      } else if (op === '×') {
        c = generateNum(lenC);
        const minA_len = Math.pow(10, lenA - 1);
        const maxA_len = Math.pow(10, lenA) - 1;
        
        const minA_actual = minA_len;
        const maxA_actual = Math.min(maxA_len, Math.floor(limitD / c));
        
        if (minA_actual > maxA_actual) continue;
        
        a = Math.floor(Math.random() * (maxA_actual - minA_actual + 1)) + minA_actual;
        res = a * c;
      } else {
        continue;
      }

      const prob = `${a} ${op} ${c} = `;
      if (!newProblems.includes(prob)) {
        newProblems.push(prob);
      } else if (attempts > maxAttempts / 2) {
        newProblems.push(prob);
      }
    }

    if (newProblems.length < 50) {
      setError(`条件有点严格哦，只生成了 ${newProblems.length} 道题。`);
    }
    
    setProblems(newProblems);
    setShowPreview(true);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('请允许浏览器弹出窗口以进行打印！');
      return;
    }

    const problemsHtml = problems.map((p, i) => `
      <div class="problem">
        <span class="index">(${i + 1})</span>
        <span class="equation">${p}</span>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>数学练习题 - dude-arithmetic</title>
          <style>
            @page { size: A4; margin: 12mm 15mm; }
            body { 
              font-family: "Nunito", "Comic Sans MS", "Chalkboard SE", sans-serif; 
              margin: 0; 
              padding: 0; 
              color: #000; 
              -webkit-print-color-adjust: exact;
              box-sizing: border-box;
            }
            .page-container {
              height: 273mm; /* 297mm - 24mm margins */
              overflow: hidden;
              position: relative;
            }
            .content-wrapper {
              width: 100%;
            }
            .header { text-align: center; margin-bottom: 15px; }
            .title { font-size: 26px; font-weight: bold; margin: 0; letter-spacing: 2px; }
            .info-row { 
              display: flex; 
              justify-content: space-between; 
              margin-top: 15px; 
              font-size: 16px; 
              border-bottom: 2px solid #000; 
              padding-bottom: 8px; 
            }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(${columns}, 1fr); 
              column-gap: ${columns > 2 ? '20px' : '40px'}; 
              row-gap: ${Math.max(4, 24 - fontSize * 0.5)}px; 
              margin-top: 15px;
            }
            .problem { 
              font-size: ${fontSize}px; 
              display: flex; 
              align-items: center; 
              line-height: 1.2;
            }
            .index { 
              width: 2.5em; 
              text-align: right; 
              margin-right: 0.5em; 
              color: #666; 
              font-size: 0.8em; 
            }
            .equation { 
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
              letter-spacing: 2px; 
            }
          </style>
        </head>
        <body>
          <div class="page-container" id="page-container">
            <div class="content-wrapper" id="content-wrapper">
              <div class="header">
                <h1 class="title">数学练习题</h1>
                <div class="info-row">
                  <span>姓名：___________</span>
                  <span>日期：___________</span>
                  <span>得分：___________</span>
                </div>
              </div>
              <div class="grid">
                ${problemsHtml}
              </div>
            </div>
          </div>
          <script>
            window.onload = () => {
              const container = document.getElementById('page-container');
              const content = document.getElementById('content-wrapper');
              const scale = Math.min(1, container.clientHeight / content.scrollHeight);
              if (scale < 1) {
                content.style.transform = 'scale(' + scale + ')';
                content.style.transformOrigin = 'top center';
              }
              setTimeout(() => {
                window.print();
              }, 300);
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
    <div className="min-h-screen p-4 md:p-8 font-sans">
      {/* Configuration UI (Hidden when printing) */}
      <div className="no-print max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-white/40 backdrop-blur-md rounded-full shadow-sm mb-4">
            <Calculator className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-800 drop-shadow-sm">趣味数学题生成器</h1>
          <p className="text-gray-600 mt-2 text-lg">轻松生成 A4 打印版加减乘除练习题</p>
        </div>

        <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

          <div className="space-y-8 relative z-10">
            {/* Section A */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">A</span>
                数字 A 的位数
              </h2>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map(num => (
                  <ToggleButton 
                    key={`a-${num}`} 
                    active={digitsA.includes(num)} 
                    onClick={() => toggleArrayItem(digitsA, setDigitsA, num)}
                  >
                    {num} 位数
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* Section B */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">B</span>
                运算符号
              </h2>
              <div className="flex flex-wrap gap-3">
                {['+', '-', '×', '÷'].map(op => (
                  <ToggleButton 
                    key={`op-${op}`} 
                    active={operators.includes(op)} 
                    onClick={() => toggleArrayItem(operators, setOperators, op)}
                  >
                    <span className="text-2xl leading-none">{op}</span>
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* Section C */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-green-100 text-green-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">C</span>
                数字 C 的位数
              </h2>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map(num => (
                  <ToggleButton 
                    key={`c-${num}`} 
                    active={digitsC.includes(num)} 
                    onClick={() => toggleArrayItem(digitsC, setDigitsC, num)}
                  >
                    {num} 位数
                  </ToggleButton>
                ))}
              </div>
            </div>

            {/* Section D */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
                <span className="bg-orange-100 text-orange-600 w-8 h-8 rounded-lg flex items-center justify-center mr-2">D</span>
                答案上限 D (≤)
              </h2>
              <input 
                type="number" 
                value={limitD}
                onChange={(e) => setLimitD(parseInt(e.target.value) || 0)}
                className="w-full md:w-64 px-4 py-3 rounded-xl bg-white/60 border border-white/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-xl font-bold text-gray-700"
                min="1"
              />
            </div>

            {error && (
              <div className="bg-red-50/80 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button 
                onClick={generateProblems}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl font-bold text-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center"
              >
                <Settings2 className="w-6 h-6 mr-2" />
                生成 50 道题目
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal (Hidden when printing, but its contents are shown) */}
      {showPreview && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">预览与打印</h3>
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={handlePrint}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center shadow-md shadow-blue-500/20 transition-colors text-sm sm:text-base"
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
            
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 p-4 border-b border-gray-100 bg-white overflow-y-auto max-h-[40vh] sm:max-h-none">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <span className="text-gray-700 font-bold text-sm sm:text-base">排版列数:</span>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap bg-gray-100 p-1 rounded-lg gap-1 w-full sm:w-auto">
                  {[2, 3, 4].map(c => (
                    <button 
                      key={c} 
                      onClick={() => setColumns(c)}
                      className={cn("px-2 sm:px-4 py-1.5 rounded-md font-medium transition-colors text-sm sm:text-base text-center", columns === c ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                    >
                      {c} 列
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <span className="text-gray-700 font-bold text-sm sm:text-base">字体大小:</span>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap bg-gray-100 p-1 rounded-lg gap-1 w-full sm:w-auto">
                  {[16, 20, 24, 28, 32, 36].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setFontSize(s)}
                      className={cn("px-1 sm:px-3 py-1.5 rounded-md font-medium transition-colors text-xs sm:text-base text-center", fontSize === s ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900")}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 sm:ml-auto flex items-center w-full sm:w-auto mt-2 sm:mt-0">
                <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                若内容超出，将自动缩放以适应单页A4
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-gray-100 flex justify-center" ref={outerContainerRef}>
              {/* A4 Paper Simulation */}
              <div style={{ width: `${794 * paperScale}px`, height: `${1123 * paperScale}px`, position: 'relative' }} className="flex-shrink-0">
                <div className="bg-white shadow-md absolute top-0 left-0 origin-top-left overflow-hidden" style={{ width: '794px', height: '1123px', padding: '45px 56px', boxSizing: 'border-box', transform: `scale(${paperScale})` }}>
                <div 
                  ref={previewContainerRef}
                  className="w-full h-full relative"
                >
                  <div 
                    ref={previewContentRef}
                    className="w-full origin-top"
                    style={{ transform: `scale(${previewScale})` }}
                  >
                    <div className="text-center mb-4">
                      <h1 className="text-[26px] font-bold text-gray-800 leading-tight">数学练习题</h1>
                      <div className="flex justify-between mt-4 text-base text-gray-600 border-b-2 border-gray-800 pb-2">
                        <span>姓名：___________</span>
                        <span>日期：___________</span>
                        <span>得分：___________</span>
                      </div>
                    </div>
                    
                    <div className="grid mt-4" style={{ 
                      gridTemplateColumns: `repeat(${columns}, 1fr)`,
                      columnGap: columns > 2 ? '20px' : '40px',
                      rowGap: `${Math.max(4, 24 - fontSize * 0.5)}px`
                    }}>
                      {problems.map((p, i) => (
                        <div key={i} className="font-mono flex items-center" style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}>
                          <span className="text-right text-gray-400 font-sans" style={{ width: '2.5em', marginRight: '0.5em', fontSize: '0.8em' }}>({i + 1})</span>
                          <span className="tracking-widest">{p}</span>
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
