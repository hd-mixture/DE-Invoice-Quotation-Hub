"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Sparkles,
  Clock
} from "lucide-react";
import { cn } from "../../lib/utils";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  isInvoiceTheme?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Select Date",
  className,
  disabled = false,
  required = false,
  isInvoiceTheme = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or fallback to today
  const parseValueDate = (valStr: string): { year: number; month: number; day: number } | null => {
    if (!valStr) return null;
    const parts = valStr.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d };
      }
    }
    return null;
  };

  const parsedValue = parseValueDate(value);
  const today = new Date();
  
  const [viewYear, setViewYear] = useState<number>(
    parsedValue ? parsedValue.year : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    parsedValue ? parsedValue.month : today.getMonth()
  );

  // Synchronize view state if value changes externally
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [value]);

  // Outside click listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const formattedMonth = String(now.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(now.getDate()).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleSetTomorrow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(tomorrow.getDate()).padStart(2, "0");
    const dateStr = `${tomorrow.getFullYear()}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setViewYear(tomorrow.getFullYear());
    setViewMonth(tomorrow.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Display text formatting
  const displayFormattedDate = parsedValue
    ? `${parsedValue.day} ${SHORT_MONTH_NAMES[parsedValue.month]} ${parsedValue.year}`
    : "";

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!parsedValue) return false;
    return (
      day === parsedValue.day &&
      viewMonth === parsedValue.month &&
      viewYear === parsedValue.year
    );
  };

  // Generate years range for select dropdown
  const currentYearNum = today.getFullYear();
  const yearOptions = [];
  for (let y = currentYearNum - 10; y <= currentYearNum + 10; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      {label && (
        <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}

      {/* Main Interactive Button Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-11 px-3.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all duration-200 cursor-pointer select-none group text-left",
          isInvoiceTheme
            ? "bg-white/80 dark:bg-zinc-900/80 border-slate-200 dark:border-white/10 hover:border-violet-500/50 focus:border-violet-500 shadow-sm"
            : "bg-white/80 dark:bg-zinc-900/80 border-slate-200 dark:border-white/10 hover:border-orange-500/50 focus:border-[#E55A22] shadow-sm",
          isOpen && (isInvoiceTheme ? "border-violet-500 ring-2 ring-violet-500/20" : "border-[#E55A22] ring-2 ring-orange-500/20"),
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110",
            isInvoiceTheme
              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
              : "bg-orange-500/10 text-[#E55A22] dark:text-orange-400 border border-orange-500/20"
          )}>
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <span className={cn(
            "text-xs font-bold truncate",
            displayFormattedDate
              ? "text-slate-900 dark:text-white"
              : "text-slate-400 dark:text-zinc-500"
          )}>
            {displayFormattedDate || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <div 
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title="Clear Date"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <ChevronRight className={cn(
            "w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200",
            isOpen && "rotate-90"
          )} />
        </div>
      </button>

      {/* Floating Glassmorphic Calendar Popover */}
      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 w-[310px] p-4 rounded-2xl border shadow-2xl backdrop-blur-2xl select-none animate-in fade-in zoom-in-95 duration-200",
            isInvoiceTheme
              ? "bg-white/95 dark:bg-zinc-950/95 border-slate-200 dark:border-zinc-800 shadow-violet-500/10"
              : "bg-white/95 dark:bg-zinc-950/95 border-slate-200 dark:border-zinc-800 shadow-orange-500/10"
          )}
        >
          {/* Popover Header: Month & Year Selector + Controls */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-zinc-800/80">
            {/* Prev Month */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month & Year Selection Dropdowns */}
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white outline-none cursor-pointer hover:opacity-80 py-1 rounded-md"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none cursor-pointer hover:opacity-80 py-1 rounded-md"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Next Month */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500 py-0.5">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="w-8 h-8" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const selected = isSelected(dayNum);
              const todayDate = isToday(dayNum);

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={cn(
                    "w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center transition-all duration-150 relative cursor-pointer mx-auto",
                    selected
                      ? isInvoiceTheme
                        ? "bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black shadow-md shadow-violet-500/30 scale-105"
                        : "bg-gradient-to-tr from-[#E55A22] to-orange-500 text-white font-black shadow-md shadow-orange-500/30 scale-105"
                      : todayDate
                      ? isInvoiceTheme
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 font-extrabold border border-violet-500/40"
                        : "bg-orange-500/10 text-[#E55A22] dark:text-orange-400 font-extrabold border border-orange-500/40"
                      : "text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 active:scale-95"
                  )}
                >
                  <span>{dayNum}</span>
                  {todayDate && !selected && (
                    <span className={cn("absolute bottom-1 w-1 h-1 rounded-full", isInvoiceTheme ? "bg-violet-500" : "bg-[#E55A22]")} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Action Presets Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={handleSetToday}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[10.5px] font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1",
                isInvoiceTheme
                  ? "bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400"
                  : "bg-orange-500/10 hover:bg-orange-500/20 text-[#E55A22] dark:text-orange-400"
              )}
            >
              <Sparkles className="w-3 h-3" />
              <span>Today</span>
            </button>

            <button
              type="button"
              onClick={handleSetTomorrow}
              className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10.5px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Tomorrow</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 text-[10.5px] font-bold transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
