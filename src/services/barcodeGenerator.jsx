// Code 128B Encoding Table (107 patterns)
// Each pattern string represents 6 alternating widths: [bar, space, bar, space, bar, space]
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '122213', '122312', '131222', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '222121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=StartB, 105=StartC, 106=Stop)
];

const START_B = 104;
const STOP = 106;

/**
 * Generate Code 128B pattern bars array from ASCII text string
 */
export function encodeCode128B(text) {
  if (!text) return null;
  const clean = text.replace(/[^\x20-\x7E]/g, ''); // Filter ASCII 32-126
  if (!clean) return null;

  const codes = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP);

  // Convert pattern strings into width array [width, isBar]
  const bars = [];
  codes.forEach(codeIdx => {
    const pattern = CODE128_PATTERNS[codeIdx];
    if (!pattern) return;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10);
      const isBar = i % 2 === 0;
      bars.push({ width, isBar });
    }
  });

  return bars;
}

/**
 * Generate a unique numeric 13-digit barcode (EAN-13 style starting with 885 prefix)
 */
export function generateUniqueBarcode(products = []) {
  const existingSet = new Set(products.map(p => p.barcode).filter(Boolean));
  
  // Try up to 1000 times to generate a guaranteed unique 13-digit code
  for (let i = 0; i < 1000; i++) {
    const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
    const candidate = `885${randomPart}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  return `885${Date.now().toString().slice(-9)}`;
}

/**
 * React Component for rendering SVG Barcode
 */
export function BarcodeSvg({ value, height = 50, barWidth = 2, className = '' }) {
  const bars = encodeCode128B(value || '');

  if (!bars || bars.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic text-center py-2">
        Invalid barcode text
      </div>
    );
  }

  let totalWidth = 0;
  bars.forEach(b => { totalWidth += b.width * barWidth; });

  let currentX = 0;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg 
        width={totalWidth} 
        height={height} 
        viewBox={`0 0 ${totalWidth} ${height}`} 
        className="block max-w-full"
      >
        {bars.map((b, idx) => {
          const w = b.width * barWidth;
          const x = currentX;
          currentX += w;
          if (!b.isBar) return null;
          return (
            <rect 
              key={idx} 
              x={x} 
              y={0} 
              width={w} 
              height={height} 
              fill="currentColor" 
            />
          );
        })}
      </svg>
      {value && (
        <span className="font-mono text-[11px] tracking-widest font-bold mt-1 text-foreground">
          {value}
        </span>
      )}
    </div>
  );
}
