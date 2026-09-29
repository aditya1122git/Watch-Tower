import React from 'react';
import { Language } from '../i18n';

interface SentimentGaugeProps {
  score: number; // -100 to +100
  lang: Language;
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({ score, lang }) => {
  // Normalize score (-100..+100 to 0..100 for rotation)
  const normalized = Math.max(0, Math.min(100, (score + 100) / 2));
  const rotation = (normalized / 100) * 180 - 90; // -90deg to +90deg

  let colorClass = 'text-amber-500';
  let label = lang === 'hi' ? 'तटस्थ / मिलाजुला' : 'Neutral / Mixed';

  if (score >= 30) {
    colorClass = 'text-emerald-500';
    label = lang === 'hi' ? 'सकारात्मक (सीएम समर्थक)' : 'Strongly Positive (Pro-CM)';
  } else if (score > 10) {
    colorClass = 'text-teal-500';
    label = lang === 'hi' ? 'सकारात्मक झुकाव' : 'Moderately Positive';
  } else if (score <= -30) {
    colorClass = 'text-rose-600';
    label = lang === 'hi' ? 'तीव्र नकारात्मक (विरोध)' : 'Strongly Critical / Hostile';
  } else if (score < -10) {
    colorClass = 'text-orange-500';
    label = lang === 'hi' ? 'नकारात्मक झुकाव' : 'Moderately Critical';
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {lang === 'hi' ? 'मुख्यमंत्री के प्रति समग्र दृष्टिकोण' : 'Overall Stance Towards CM'}
      </h3>

      {/* Semi-circle Gauge Meter */}
      <div className="relative w-48 h-24 overflow-hidden flex items-end justify-center">
        {/* Track */}
        <div className="absolute w-44 h-44 rounded-full border-[14px] border-slate-100 dark:border-slate-800 border-b-transparent border-l-transparent -rotate-45" />
        
        {/* Colored Segments */}
        <div className="absolute w-44 h-44 rounded-full border-[14px] border-transparent border-t-rose-500/80 border-r-amber-400/80 -rotate-45" />
        <div className="absolute w-44 h-44 rounded-full border-[14px] border-transparent border-l-emerald-500/80 -rotate-45" />

        {/* Needle */}
        <div
          className="absolute bottom-0 w-1.5 h-20 bg-slate-800 dark:bg-white rounded-t-full origin-bottom transition-transform duration-700 ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        {/* Needle Hub */}
        <div className="absolute bottom-[-6px] w-5 h-5 rounded-full bg-slate-900 dark:bg-white border-2 border-white dark:border-slate-900 shadow-md" />
      </div>

      {/* Value Readout */}
      <div className="mt-3 text-center">
        <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1)}
          <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
        </div>
        <p className={`text-xs font-semibold mt-0.5 ${colorClass}`}>
          {label}
        </p>
      </div>

      {/* Legend */}
      <div className="w-full flex justify-between text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>-100 (Critical)</span>
        <span>0 (Neutral)</span>
        <span>+100 (Favorable)</span>
      </div>
    </div>
  );
};
