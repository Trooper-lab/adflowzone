'use client';

import React from 'react';

type LoadingScreenProps = {
  label?: string;
};

export function LoadingScreen({ label = 'Initialiseren...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#060d1a]" style={{ backgroundColor: '#060d1a' }}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center h-16 w-32">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse bg-primary/20" />
          <svg
            className="w-full h-full relative z-10"
            viewBox="0 0 100 40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="loader-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4d8eff" />
                <stop offset="50%" stopColor="#4edea3" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            {/* Line 1 */}
            <path
              d="M 5,8 Q 25,2 50,8 T 95,8"
              fill="none"
              stroke="url(#loader-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="15 45"
              style={{
                animation: 'flow-line-pulse 1.8s linear infinite'
              }}
              opacity="0.35"
            >
              <animate
                attributeName="d"
                dur="3s"
                repeatCount="indefinite"
                values="
                  M 5,8 Q 25,2 50,8 T 95,8;
                  M 5,8 Q 25,14 50,8 T 95,8;
                  M 5,8 Q 25,2 50,8 T 95,8
                "
              />
            </path>
            {/* Line 2 */}
            <path
              d="M 5,14 Q 25,20 50,14 T 95,14"
              fill="none"
              stroke="url(#loader-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="20 50"
              style={{
                animation: 'flow-line-pulse-reverse 2.2s linear infinite'
              }}
              opacity="0.6"
            >
              <animate
                attributeName="d"
                dur="4s"
                repeatCount="indefinite"
                values="
                  M 5,14 Q 25,20 50,14 T 95,14;
                  M 5,14 Q 25,8 50,14 T 95,14;
                  M 5,14 Q 25,20 50,14 T 95,14
                "
              />
            </path>
            {/* Line 3 */}
            <path
              d="M 5,20 Q 25,12 50,20 T 95,20"
              fill="none"
              stroke="url(#loader-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            >
              <animate
                attributeName="d"
                dur="2.5s"
                repeatCount="indefinite"
                values="
                  M 5,20 Q 25,12 50,20 T 95,20;
                  M 5,20 Q 25,28 50,20 T 95,20;
                  M 5,20 Q 25,12 50,20 T 95,20
                "
              />
            </path>
            {/* Line 4 */}
            <path
              d="M 5,26 Q 25,32 50,26 T 95,26"
              fill="none"
              stroke="url(#loader-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="20 50"
              style={{
                animation: 'flow-line-pulse-reverse 2.0s linear infinite'
              }}
              opacity="0.6"
            >
              <animate
                attributeName="d"
                dur="3.5s"
                repeatCount="indefinite"
                values="
                  M 5,26 Q 25,32 50,26 T 95,26;
                  M 5,26 Q 25,20 50,26 T 95,26;
                  M 5,26 Q 25,32 50,26 T 95,26
                "
              />
            </path>
            {/* Line 5 */}
            <path
              d="M 5,32 Q 25,26 50,32 T 95,32"
              fill="none"
              stroke="url(#loader-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="15 45"
              style={{
                animation: 'flow-line-pulse 2.4s linear infinite'
              }}
              opacity="0.35"
            >
              <animate
                attributeName="d"
                dur="4.5s"
                repeatCount="indefinite"
                values="
                  M 5,32 Q 25,26 50,32 T 95,32;
                  M 5,32 Q 25,38 50,32 T 95,32;
                  M 5,32 Q 25,26 50,32 T 95,32
                "
              />
            </path>
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="font-label-caps text-[10px] tracking-[0.25em] uppercase text-slate-300">AdFlow Zone</p>
          <p className="text-[9px] font-label-caps text-slate-500 tracking-widest uppercase">{label}</p>
        </div>
      </div>
    </div>
  );
}
