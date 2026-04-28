import React from 'react'

export function CubeLogo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Forcing Function"
    >
      <g stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M6 10 L16 5 L26 10 L16 15 Z" />
        <path d="M6 10 L6 22 L16 27 L16 15" />
        <path d="M26 10 L26 22 L16 27" />
        <path d="M16 15 L16 27" opacity="0.5" />
      </g>
    </svg>
  )
}
