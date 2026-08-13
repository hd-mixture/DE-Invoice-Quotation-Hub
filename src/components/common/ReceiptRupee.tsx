import React from 'react';

export const ReceiptRupee: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className = "w-6 h-6",
  style 
}) => (
  <svg 
    className={className} 
    style={style}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Receipt Jagged Paper Outline */}
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    
    {/* Perfect Lucide IndianRupee (₹) Symbol scaled 52% and 100% mathematically centered */}
    <g transform="translate(5.76, 5.6) scale(0.52)">
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3a4 4 0 0 0 0-8H6" />
    </g>
  </svg>
);

export default ReceiptRupee;
