import React from 'react';

export function LogoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      style={{ ...props.style, fontFamily: "'Squada One', sans-serif" }}
    >
      <text
        x="50"
        y="50"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="75"
        fontWeight="bold"
        fill="currentColor"
      >
        GO
      </text>
    </svg>
  );
}
