'use client';

import React from 'react';

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label = 'Initialiseren...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060d1a]" style={{ backgroundColor: '#060d1a' }}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center h-28 w-28">
          {/* Ambient background glow */}
          <div className="absolute inset-4 rounded-full blur-2xl opacity-40 animate-pulse bg-blue-500/20" />
          
          <svg
            className="w-full h-full relative z-10"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="go-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4d8eff" />
                <stop offset="50%" stopColor="#4edea3" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* 1. Outer Coordinate Ring (Fine Tick Marks) - Clockwise slow */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#go-loader-grad)"
              strokeWidth="0.75"
              strokeDasharray="2 6"
              style={{ animation: 'spin 32s linear infinite', transformOrigin: '50px 50px' }}
              opacity="0.3"
            />

            {/* 2. Middle Telemetry Ring (Alternating Data Segments) - Counter-clockwise */}
            <circle
              cx="50"
              cy="50"
              r="37"
              fill="none"
              stroke="url(#go-loader-grad)"
              strokeWidth="1.5"
              strokeDasharray="30 15 10 15 5 15"
              style={{ animation: 'spin 12s linear infinite reverse', transformOrigin: '50px 50px' }}
              opacity="0.5"
            />

            {/* 3. Inner Orbit Ring (Fine Nodes) - Clockwise */}
            <circle
              cx="50"
              cy="50"
              r="29"
              fill="none"
              stroke="url(#go-loader-grad)"
              strokeWidth="1"
              strokeDasharray="1 12"
              strokeLinecap="round"
              style={{ animation: 'spin 20s linear infinite', transformOrigin: '50px 50px' }}
              opacity="0.65"
            />

            {/* 4. Scanning Radar Line - Clockwise fast */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="13"
              stroke="url(#go-loader-grad)"
              strokeWidth="1.25"
              strokeLinecap="round"
              style={{ animation: 'spin 3.5s linear infinite', transformOrigin: '50px 50px' }}
              opacity="0.45"
            />

            {/* 5. Center Core Node */}
            <circle
              cx="50"
              cy="50"
              r="22"
              fill="rgba(15, 23, 42, 0.9)"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
            />

            {/* 6. Central GO Brand logo image */}
            <image
              href="/go-logo.png"
              x="34"
              y="34"
              height="32"
              width="32"
            />
          </svg>
        </div>

        {/* Status indicator / telemetry text readout */}
        <div 
          className="text-center space-y-1.5"
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        >
          <p className="font-label-caps text-[10px] tracking-[0.3em] uppercase text-slate-300 font-bold">SYSTEM SCANNING</p>
          <p className="text-[9px] font-label-caps text-slate-500 tracking-widest uppercase">{label}</p>
        </div>
      </div>
    </div>
  );
}
