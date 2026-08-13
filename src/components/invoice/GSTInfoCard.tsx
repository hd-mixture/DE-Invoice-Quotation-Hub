import React from 'react';
import { GSTINValidationResult } from '../../utils/gstValidation';
import { CheckCircle2, XCircle, Building, Hash, CreditCard } from 'lucide-react';

interface GSTInfoCardProps {
  validation: GSTINValidationResult;
}

export const GSTInfoCard: React.FC<GSTInfoCardProps> = ({ validation }) => {
  const { isValid, gstin, pan, stateCode, stateName, errorMsg } = validation;

  if (!gstin) {
    return null; // Don't show anything if empty
  }

  return (
    <div className="w-full mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
        isValid 
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
          : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
      }`}>
        {isValid ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Verified • {stateName}</span>
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Invalid GSTIN{errorMsg ? `: ${errorMsg}` : ''}</span>
          </>
        )}
      </div>
    </div>
  );
};
