import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, FileText, CloudUpload, DollarSign, IndianRupee, Calendar, RefreshCcw, DownloadCloud, ChevronLeft, ChevronRight, Search, Download, CheckCircle2, AlertCircle, Clock, Wallet } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line, Cell, PieChart, Pie, Legend } from 'recharts';
import { TaxInvoice } from '../../types';
import { formatCurrency, parseDateStringToYearMonthDay, cn } from '../../lib/utils';

const isInvoiceOverdue = (inv: TaxInvoice): boolean => {
  if (inv.status !== "sent") return false;
  const dateToUse = inv.billDate || inv.createdAt;
  const parsed = parseDateStringToYearMonthDay(dateToUse);
  if (!parsed) return false;
  const billDate = new Date(parsed.year, parsed.month, parsed.day);
  const today = new Date();
  const diffTime = today.getTime() - billDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 15;
};

interface AnalyticsModalsProps {
  activeModal: 'invoices' | 'revenue' | 'backups' | null;
  onClose: () => void;
  invoices: TaxInvoice[];
  currentMonth: number;
  currentYear: number;
  selectedMonthYear: string;
}

export const AnalyticsModals: React.FC<AnalyticsModalsProps> = ({
  activeModal,
  onClose,
  invoices,
  currentMonth,
  currentYear,
  selectedMonthYear
}) => {
  const [localMonth, setLocalMonth] = useState(currentMonth);
  const [localYear, setLocalYear] = useState(currentYear);
  const [chartView, setChartView] = useState<'daily' | 'weekly'>('daily');
  const [showSearch, setShowSearch] = useState(false);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [viewAllType, setViewAllType] = useState<'invoices' | 'revenue' | 'backups' | null>(null);
  const [canvasSearchQuery, setCanvasSearchQuery] = useState('');

  useEffect(() => {
    setLocalMonth(currentMonth);
    setLocalYear(currentYear);
  }, [currentMonth, currentYear]);

  useEffect(() => {
    setAnalyticsSearchQuery('');
    setShowSearch(false);
    setViewAllType(null);
    setCanvasSearchQuery('');
  }, [activeModal, localMonth, localYear]);

  const handleExportCSV = (type: 'invoices' | 'revenue' | 'backups') => {
    if (!currentMonthInvoices || currentMonthInvoices.length === 0) {
      alert("No data available for this month to download.");
      return;
    }

    const monthName = new Date(localYear, localMonth).toLocaleString('en-IN', { month: 'long' });
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = "";

    if (type === 'invoices') {
      filename = `Invoice_Analytics_${monthName}_${localYear}.csv`;
      headers = ["Bill Number", "Bill Date", "Client Name", "Client GSTIN", "Subtotal (INR)", "GST Total (INR)", "Grand Total (INR)", "Payment Status", "Source Type"];
      rows = currentMonthInvoices.filter(i => !i.isDeleted).map(inv => [
        `"${inv.billNumber || ''}"`,
        `"${inv.billDate || ''}"`,
        `"${(inv.billedTo?.clientName || '').replace(/"/g, '""')}"`,
        `"${inv.billedTo?.clientGstin || ''}"`,
        inv.subTotal || 0,
        inv.gstTotal || 0,
        inv.grandTotal || 0,
        `"${inv.paymentStatus === 'paid' || inv.status === 'paid' ? 'PAID' : 'PENDING'}"`,
        `"${inv.isImported || inv.invoiceType === 'imported' ? 'IMPORTED' : 'MANUAL'}"`
      ]);
    } else if (type === 'revenue') {
      filename = `Revenue_Analytics_${monthName}_${localYear}.csv`;
      headers = ["Bill Number", "Bill Date", "Client Name", "Grand Total (INR)", "Payment Status", "Created Date"];
      rows = currentMonthInvoices.filter(i => !i.isDeleted && !i.isCancelled).map(inv => [
        `"${inv.billNumber || ''}"`,
        `"${inv.billDate || ''}"`,
        `"${(inv.billedTo?.clientName || '').replace(/"/g, '""')}"`,
        inv.grandTotal || 0,
        `"${inv.paymentStatus === 'paid' || inv.status === 'paid' ? 'PAID' : 'UNPAID/PENDING'}"`,
        `"${inv.createdAt || ''}"`
      ]);
    } else {
      filename = `Cloud_Sync_Backups_${monthName}_${localYear}.csv`;
      headers = ["Bill Number", "Client Name", "Google Drive Sync Status", "Drive File URL", "Created Date"];
      rows = currentMonthInvoices.filter(i => !i.isDeleted).map(inv => [
        `"${inv.billNumber || ''}"`,
        `"${(inv.billedTo?.clientName || '').replace(/"/g, '""')}"`,
        `"${inv.driveUrl ? 'SYNCED TO GOOGLE DRIVE' : 'NOT SYNCED'}"`,
        `"${inv.driveUrl || 'N/A'}"`,
        `"${inv.createdAt || ''}"`
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeModal]);

  const { minYear, minMonth, maxYear, maxMonth } = useMemo(() => {
    const today = new Date();
    let minD = today;
    if (invoices.length > 0) {
      const dates = invoices.map(i => i.billDate ? new Date(i.billDate).getTime() : today.getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        minD = new Date(Math.min(...dates));
      }
    }
    return {
      minYear: minD.getFullYear(),
      minMonth: minD.getMonth(),
      maxYear: today.getFullYear(),
      maxMonth: today.getMonth()
    };
  }, [invoices]);

  const canGoPrev = localYear > minYear || (localYear === minYear && localMonth > minMonth);
  const canGoNext = localYear < maxYear || (localYear === maxYear && localMonth < maxMonth);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (localMonth === 0) {
      setLocalMonth(11);
      setLocalYear(prev => prev - 1);
    } else {
      setLocalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (localMonth === 11) {
      setLocalMonth(0);
      setLocalYear(prev => prev + 1);
    } else {
      setLocalMonth(prev => prev + 1);
    }
  };

  // Filter for the currently selected month
  const currentMonthInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const dateToUse = inv.billDate || inv.createdAt;
      const parsed = parseDateStringToYearMonthDay(dateToUse);
      if (!parsed) return false;
      return parsed.year === localYear && parsed.month === localMonth;
    });
  }, [invoices, localYear, localMonth]);

  // Compute previous month invoices
  const prevMonthInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const dateToUse = inv.billDate || inv.createdAt;
      const parsed = parseDateStringToYearMonthDay(dateToUse);
      if (!parsed) return false;
      const prevYear = localMonth === 0 ? localYear - 1 : localYear;
      const prevMonthIdx = localMonth === 0 ? 11 : localMonth - 1;
      return parsed.year === prevYear && parsed.month === prevMonthIdx;
    });
  }, [invoices, localYear, localMonth]);

  // Helper to compute percentage change
  const computePercentageChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  // Compute Daily Data for the selected month
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(localYear, localMonth + 1, 0).getDate();
    const result = [];

    let cumulativeInvoices = 0;
    let cumulativeRevenue = 0;
    let cumulativeSynced = 0;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${localYear}-${String(localMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayInvoices = currentMonthInvoices.filter(inv => {
        const dateToUse = inv.billDate || inv.createdAt;
        const parsed = parseDateStringToYearMonthDay(dateToUse);
        if (!parsed) return false;
        return parsed.day === i;
      });

      const count = dayInvoices.filter(inv => !inv.isDeleted).length;
      const rev = dayInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
      const synced = dayInvoices.filter(i => i.driveUrl && !i.isDeleted).length;

      cumulativeInvoices += count;
      cumulativeRevenue += rev;
      cumulativeSynced += synced;

      result.push({
        day: i,
        dateFull: dateString,
        label: `${i} ${new Date(localYear, localMonth, i).toLocaleString('en-IN', { month: 'short' })}`,
        count,
        revenue: rev,
        synced,
        cumulativeInvoices,
        cumulativeRevenue,
        cumulativeSynced,
        // Breakdown for specific views
        created: dayInvoices.filter(i => (i.invoiceType === "manual" || !i.invoiceType) && !i.isDeleted).length,
        imported: dayInvoices.filter(i => (i.invoiceType === "imported" || i.isImported) && !i.isDeleted).length,
        unpaidRev: dayInvoices.filter(i => (i.status === "draft" || i.status === "sent" || i.paymentStatus === "unpaid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0)
      });
    }
    return result;
  }, [currentMonthInvoices, localYear, localMonth]);

  // Compute Weekly Data based on dailyData
  const weeklyData = useMemo(() => {
    const weeks: any[] = [];
    for (let i = 0; i < dailyData.length; i += 7) {
      const chunk = dailyData.slice(i, i + 7);
      if (chunk.length === 0) continue;
      
      const lastDay = chunk[chunk.length - 1];
      const weekLabel = `Week ${weeks.length + 1}`;
      
      weeks.push({
        label: weekLabel,
        dateFull: `${chunk[0].dateFull} to ${lastDay.dateFull}`,
        count: chunk.reduce((sum, d) => sum + d.count, 0),
        revenue: chunk.reduce((sum, d) => sum + d.revenue, 0),
        synced: chunk.reduce((sum, d) => sum + d.synced, 0),
        created: chunk.reduce((sum, d) => sum + d.created, 0),
        imported: chunk.reduce((sum, d) => sum + d.imported, 0),
        cumulativeInvoices: lastDay.cumulativeInvoices,
        cumulativeRevenue: lastDay.cumulativeRevenue,
        cumulativeSynced: lastDay.cumulativeSynced,
      });
    }
    return weeks;
  }, [dailyData]);

  const monthLabelFull = new Date(localYear, localMonth, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // --- Invoice Modal Content ---
  const renderInvoicesModal = () => {
    const total = currentMonthInvoices.filter(i => !i.isDeleted).length;
    const imported = currentMonthInvoices.filter(i => (i.invoiceType === "imported" || i.isImported || !!i.importSource) && !i.isDeleted).length;
    const manual = currentMonthInvoices.filter(i => (i.invoiceType === "manual" || !i.invoiceType) && !i.isImported && !i.importSource && !i.isDeleted).length;
    const paid = currentMonthInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted).length;

    const prevTotal = prevMonthInvoices.filter(i => !i.isDeleted).length;
    const prevImported = prevMonthInvoices.filter(i => (i.invoiceType === "imported" || i.isImported) && !i.isDeleted).length;
    const prevManual = prevMonthInvoices.filter(i => (i.invoiceType === "manual" || !i.invoiceType) && !i.isDeleted).length;
    const prevPaid = prevMonthInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted).length;

    const totalChange = computePercentageChange(total, prevTotal);
    const importedChange = computePercentageChange(imported, prevImported);
    const manualChange = computePercentageChange(manual, prevManual);
    const paidChange = computePercentageChange(paid, prevPaid);

    const prevMonthLabel = localMonth === 0 ? `Dec ${localYear - 1}` : new Date(localYear, localMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

    // For Donut Chart
    const pending = currentMonthInvoices.filter(i => (i.status === "sent" || i.status === "draft") && !i.isDeleted && !i.isCancelled).length;
    const overdue = currentMonthInvoices.filter(i => isInvoiceOverdue(i) && !i.isDeleted && !i.isCancelled).length;
    const cancelled = currentMonthInvoices.filter(i => i.isCancelled && !i.isDeleted).length;

    const statusData = [
      { name: 'Paid', value: paid, color: '#8B5CF6' },
      { name: 'Pending', value: pending, color: '#F59E0B' },
      { name: 'Overdue', value: overdue, color: '#EF4444' },
      { name: 'Cancelled', value: cancelled, color: '#9CA3AF' },
    ].filter(s => s.value > 0);

    // Recent Invoices (Filtered live by analyticsSearchQuery if typed)
    const allActiveInvoices = [...currentMonthInvoices].filter(i => !i.isDeleted);
    const recentInvoices = analyticsSearchQuery.trim()
      ? allActiveInvoices.filter(inv => {
          const q = analyticsSearchQuery.toLowerCase().trim();
          const billNo = (inv.billNumber || '').toLowerCase();
          const client = (inv.billedTo?.clientName || '').toLowerCase();
          const gstin = (inv.billedTo?.clientGstin || '').toLowerCase();
          const amt = (inv.grandTotal || 0).toString();
          return billNo.includes(q) || client.includes(q) || gstin.includes(q) || amt.includes(q);
        }).slice(0, 2)
      : allActiveInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2);

    return (
      <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        {/* HEADER SECTION */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-50 dark:from-violet-500/20 dark:to-fuchsia-500/10 flex items-center justify-center shadow-inner border border-white/50 dark:border-white/5">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="pr-10 sm:pr-0">
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                Invoice Analytics Overview
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium leading-tight">Daily breakdown for {monthLabelFull}</p>
            </div>
          </div>

          {/* Right Header Cards */}
          <div className="grid grid-cols-3 sm:flex sm:flex-row flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-4 xl:mt-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Total Days</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">{new Date(localYear, localMonth + 1, 0).getDate()}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Avg. Invoices / Day</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">{(total / new Date(localYear, localMonth + 1, 0).getDate()).toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">This Month</p>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-1.5 mt-1 sm:mt-1.5 leading-none">
                  <span className={`text-[9px] sm:text-[10px] font-bold ${totalChange >= 0 ? 'text-emerald-500' : 'text-red-500'} whitespace-nowrap`}>
                    {totalChange >= 0 ? '▲' : '▼'} {Math.abs(totalChange).toFixed(1)}%
                  </span>
                  <span className="text-[7.5px] sm:text-[10px] text-slate-400 whitespace-nowrap">vs {prevMonthLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GRAPH SECTION */}
        <div className="w-full glass-panel rounded-xl sm:rounded-2xl p-3 bg-white/70 dark:bg-zinc-900/70 border border-white dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl">
              <button 
                onClick={() => setChartView('daily')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'daily' ? 'bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => setChartView('weekly')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'weekly' ? 'bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}
              >
                Weekly
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500 uppercase">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                  New
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  Imported
                </div>
              </div>

              <div className="flex gap-1.5 items-center">
                <div className={cn(
                  "flex items-center gap-2 bg-slate-100 dark:bg-zinc-950 rounded-xl border transition-all duration-300 ease-out origin-right overflow-hidden",
                  showSearch 
                    ? "w-44 sm:w-64 md:w-72 px-2.5 py-1 opacity-100 scale-x-100 border-slate-200 dark:border-white/10" 
                    : "w-0 px-0 py-0 opacity-0 scale-x-90 border-transparent pointer-events-none"
                )}>
                  <Search className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search Client, Bill No, Amount..."
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none w-full min-w-[120px]"
                    ref={(input) => { if (showSearch && input) input.focus(); }}
                  />
                  {analyticsSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setAnalyticsSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => {
                    if (showSearch) {
                      setShowSearch(false);
                      setAnalyticsSearchQuery("");
                    } else {
                      setShowSearch(true);
                    }
                  }} 
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-md border text-slate-400 cursor-pointer transition-all shrink-0 active:scale-95",
                    showSearch ? "bg-violet-600 text-white border-violet-600 shadow-xs" : "border-slate-200 dark:border-white/10 hover:text-slate-600 hover:bg-slate-50 dark:hover:text-white"
                  )}
                  title={showSearch ? "Close Search" : "Search Activity"}
                >
                  {showSearch ? <X className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => handleExportCSV('invoices')} 
                  className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-violet-600 hover:border-violet-300 dark:hover:text-violet-400 cursor-pointer transition-all shrink-0 active:scale-95"
                  title="Export Month CSV Report"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="h-32 sm:h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={chartView === 'weekly' ? weeklyData : dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(139, 92, 246, 0.1)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 dark:bg-black text-white border border-white/10 p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-xl min-w-[140px] sm:min-w-[180px]" style={{ color: 'white' }}>
                          <p className="font-bold text-[10px] sm:text-xs mb-1.5 sm:mb-3 pb-1.5 sm:pb-3 border-b border-white/10 text-white">{payload[0].payload.dateFull}</p>
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-violet-400"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">New Invoices</span>
                              </div>
                              <span className="text-xs sm:text-sm font-bold text-white">{payload[0].payload.created || 0}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Imported</span>
                              </div>
                              <span className="text-xs sm:text-sm font-bold text-white">{payload[0].payload.imported || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Imported Invoices (Bars) */}
                <Bar yAxisId="left" dataKey="imported" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={chartView === 'weekly' ? 40 : 20}>
                  {(chartView === 'weekly' ? weeklyData : dailyData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={entry.imported > 0 ? 0.8 : 0} />
                  ))}
                </Bar>

                {/* New Invoices (Area + Line) */}
                <Area yAxisId="left" type="monotone" dataKey="count" fill="url(#colorInvoices)" stroke="none" />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Card 1 */}
          <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileText className="w-8 h-8 text-violet-600" />
            </div>
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 mb-1 border border-violet-200/50 dark:border-violet-500/10">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Total</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{total}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${totalChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                {totalChange >= 0 ? '▲' : '▼'} {Math.abs(totalChange).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <CloudUpload className="w-8 h-8 text-blue-600" />
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 mb-1 border border-blue-200/50 dark:border-blue-500/10">
              <CloudUpload className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Imported</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{imported}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${importedChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                {importedChange >= 0 ? '▲' : '▼'} {Math.abs(importedChange).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 mb-1 border border-emerald-200/50 dark:border-emerald-500/10">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Paid</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{paid}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${paidChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                {paidChange >= 0 ? '▲' : '▼'} {Math.abs(paidChange).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-500 mb-1 border border-orange-200/50 dark:border-orange-500/10">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Manual</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{manual}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${manualChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                {manualChange >= 0 ? '▲' : '▼'} {Math.abs(manualChange).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: DONUT & RECENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">
          {/* Status Donut */}
          <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
            <h3 className="text-[9px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-widest mb-2">Invoice Status Breakdown</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-20 h-20 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={38}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{total}</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-1">
                {statusData.map((status) => (
                  <div key={status.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }}></div>
                      <span className="font-semibold text-slate-600 dark:text-zinc-400">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">{status.value}</span>
                      <span className="font-medium text-slate-400 w-8 text-right">({total > 0 ? Math.round((status.value / total) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
                {statusData.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic text-center w-full">No data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[9px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-widest">Recent Activity</h3>
              <button 
                onClick={() => setViewAllType('invoices')}
                className="px-2.5 py-1 rounded-lg text-[9px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({allActiveInvoices.length})</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-start gap-1">
              {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center ${(inv.status === 'paid' || inv.paymentStatus === 'paid') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' :
                        isInvoiceOverdue(inv) ? 'bg-red-100 text-red-600 dark:bg-red-500/20' :
                          'bg-orange-100 text-orange-500 dark:bg-orange-500/20'
                      }`}>
                      {(inv.status === 'paid' || inv.paymentStatus === 'paid') ? <CheckCircle2 className="w-3 h-3" /> :
                        isInvoiceOverdue(inv) ? <AlertCircle className="w-3 h-3" /> :
                          <Clock className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors leading-tight truncate">{inv.billNumber}</p>
                      <p className="text-[9px] text-slate-500 truncate leading-tight">{inv.billedTo?.clientName || 'Unknown Client'}</p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center justify-center w-16 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${(inv.status === 'paid' || inv.paymentStatus === 'paid') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' :
                        isInvoiceOverdue(inv) ? 'bg-red-50 text-red-600 dark:bg-red-500/10' :
                          'bg-orange-50 text-orange-500 dark:bg-orange-500/10'
                      }`}>
                      {(inv.status === 'paid' || inv.paymentStatus === 'paid') ? 'Paid' : isInvoiceOverdue(inv) ? 'Overdue' : 'Pending'}
                    </span>
                  </div>

                  <div className="text-right w-20 flex-shrink-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">₹{formatCurrency(inv.grandTotal)}</p>
                    <p className="text-[9px] text-slate-400 font-medium leading-tight truncate">{inv.billDate ? new Date(inv.billDate).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</p>
                  </div>
                </div>
              )) : (
                <div className="flex-1 flex flex-col items-center justify-center py-2 opacity-50">
                  <FileText className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-[10px] font-bold text-slate-500">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Revenue Modal Content ---
  const renderRevenueModal = () => {
    const totalRev = currentMonthInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
    const unpaidRev = currentMonthInvoices.filter(i => (i.status === "draft" || i.status === "sent" || i.paymentStatus === "unpaid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
    const overdueRev = currentMonthInvoices.filter(i => isInvoiceOverdue(i) && !i.isDeleted && !i.isCancelled && i.status !== "paid").reduce((acc, curr) => acc + curr.grandTotal, 0);

    const prevTotalRev = prevMonthInvoices.filter(i => (i.status === "paid" || i.paymentStatus === "paid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
    const prevUnpaidRev = prevMonthInvoices.filter(i => (i.status === "draft" || i.status === "sent" || i.paymentStatus === "unpaid") && !i.isDeleted && !i.isCancelled).reduce((acc, curr) => acc + curr.grandTotal, 0);
    const prevOverdueRev = prevMonthInvoices.filter(i => isInvoiceOverdue(i) && !i.isDeleted && !i.isCancelled && i.status !== "paid").reduce((acc, curr) => acc + curr.grandTotal, 0);

    const revChange = computePercentageChange(totalRev, prevTotalRev);
    const unpaidChange = computePercentageChange(unpaidRev, prevUnpaidRev);
    const overdueChange = computePercentageChange(overdueRev, prevOverdueRev);
    const prevCollectionRate = (prevTotalRev + prevUnpaidRev) > 0 ? (prevTotalRev / (prevTotalRev + prevUnpaidRev)) * 100 : 0;
    const collectionRate = (totalRev + unpaidRev) > 0 ? (totalRev / (totalRev + unpaidRev)) * 100 : 0;
    const collectionRateChange = collectionRate - prevCollectionRate;

    const prevMonthLabel = localMonth === 0 ? `Dec ${localYear - 1}` : new Date(localYear, localMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

    const statusData = [
      { name: 'Paid Amount', value: totalRev, color: '#10B981' },
      { name: 'Unpaid Amount', value: unpaidRev, color: '#F97316' },
      { name: 'Overdue Amount', value: overdueRev, color: '#EF4444' },
    ].filter(s => s.value > 0);

    const allActiveInvoices = [...currentMonthInvoices].filter(i => !i.isDeleted);
    const recentInvoices = analyticsSearchQuery.trim()
      ? allActiveInvoices.filter(inv => {
          const q = analyticsSearchQuery.toLowerCase().trim();
          const billNo = (inv.billNumber || '').toLowerCase();
          const client = (inv.billedTo?.clientName || '').toLowerCase();
          const amt = (inv.grandTotal || 0).toString();
          return billNo.includes(q) || client.includes(q) || amt.includes(q);
        }).slice(0, 2)
      : allActiveInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2);

    return (
      <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        {/* HEADER SECTION */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/10 flex items-center justify-center shadow-inner border border-white/50 dark:border-white/5">
              <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="pr-10 sm:pr-0">
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                Revenue Analytics Overview
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium leading-tight">Daily earnings & trends for {monthLabelFull}</p>
            </div>
          </div>

          {/* Right Header Cards */}
          <div className="grid grid-cols-3 sm:flex sm:flex-row flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-4 xl:mt-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Total Days</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">{new Date(localYear, localMonth + 1, 0).getDate()}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Avg. Revenue / Day</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">₹{formatCurrency(totalRev / new Date(localYear, localMonth + 1, 0).getDate())}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">This Month</p>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-1.5 mt-1 sm:mt-1.5 leading-none">
                  <span className={`text-[9px] sm:text-[10px] font-bold ${revChange >= 0 ? 'text-emerald-500' : 'text-red-500'} whitespace-nowrap`}>
                    {revChange >= 0 ? '▲' : '▼'} {Math.abs(revChange).toFixed(1)}%
                  </span>
                  <span className="text-[7.5px] sm:text-[10px] text-slate-400 whitespace-nowrap">vs {prevMonthLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GRAPH SECTION */}
        <div className="w-full glass-panel rounded-xl sm:rounded-2xl p-3 bg-white/70 dark:bg-zinc-900/70 border border-white dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl">
              <button 
                onClick={() => setChartView('daily')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'daily' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => setChartView('weekly')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'weekly' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}
              >
                Weekly
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500 uppercase">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Paid Amount
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  Unpaid Amount
                </div>
              </div>

              <div className="flex gap-1.5 items-center">
                <div className={cn(
                  "flex items-center gap-2 bg-slate-100 dark:bg-zinc-950 rounded-xl border transition-all duration-300 ease-out origin-right overflow-hidden",
                  showSearch 
                    ? "w-44 sm:w-64 md:w-72 px-2.5 py-1 opacity-100 scale-x-100 border-slate-200 dark:border-white/10" 
                    : "w-0 px-0 py-0 opacity-0 scale-x-90 border-transparent pointer-events-none"
                )}>
                  <Search className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search Client, Bill No, Amount..."
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none w-full min-w-[120px]"
                    ref={(input) => { if (showSearch && input) input.focus(); }}
                  />
                  {analyticsSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setAnalyticsSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => {
                    if (showSearch) {
                      setShowSearch(false);
                      setAnalyticsSearchQuery("");
                    } else {
                      setShowSearch(true);
                    }
                  }} 
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-md border text-slate-400 cursor-pointer transition-all shrink-0 active:scale-95",
                    showSearch ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "border-slate-200 dark:border-white/10 hover:text-slate-600 hover:bg-slate-50 dark:hover:text-white"
                  )}
                  title={showSearch ? "Close Search" : "Search Revenue"}
                >
                  {showSearch ? <X className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => handleExportCSV('revenue')} 
                  className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 dark:hover:text-emerald-400 cursor-pointer transition-all shrink-0 active:scale-95"
                  title="Export Month Revenue CSV Report"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="h-32 sm:h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={chartView === 'weekly' ? weeklyData : dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(16, 185, 129, 0.1)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val}`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 dark:bg-black text-white border border-white/10 p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-xl min-w-[140px] sm:min-w-[200px]" style={{ color: 'white' }}>
                          <p className="font-bold text-[10px] sm:text-xs mb-1.5 sm:mb-3 pb-1.5 sm:pb-3 border-b border-white/10 text-white">{payload[0].payload.dateFull}</p>
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Paid Amount</span>
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-white">₹{formatCurrency(payload[0].payload.revenue || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Unpaid Amount</span>
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-white">₹{formatCurrency(payload[0].payload.unpaidRev || 0)}</span>
                            </div>
                            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between gap-3 sm:gap-4">
                              <span className="text-[9px] sm:text-xs text-slate-300">Total Revenue</span>
                              <span className="text-[11px] sm:text-sm font-bold text-white">₹{formatCurrency((payload[0].payload.revenue || 0) + (payload[0].payload.unpaidRev || 0))}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Unpaid Revenue (Bars) */}
                <Bar yAxisId="left" dataKey="unpaidRev" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={chartView === 'weekly' ? 40 : 15}>
                  {(chartView === 'weekly' ? weeklyData : dailyData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={entry.unpaidRev > 0 ? 0.9 : 0} />
                  ))}
                </Bar>

                {/* Paid Revenue (Area + Line) */}
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="url(#colorRevenue)" stroke="none" />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Total Earned */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex items-center gap-3 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Earned</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none truncate">₹{formatCurrency(totalRev)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[9px] font-bold ${revChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {revChange >= 0 ? '▲' : '▼'} {Math.abs(revChange).toFixed(1)}%
                </span>
                <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
              </div>
            </div>
          </div>

          {/* Unpaid Amount */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex items-center gap-3 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Unpaid Amount</p>
              <p className="text-base font-black text-orange-500 dark:text-orange-400 leading-none truncate">₹{formatCurrency(unpaidRev)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[9px] font-bold ${unpaidChange >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {unpaidChange >= 0 ? '▲' : '▼'} {Math.abs(unpaidChange).toFixed(1)}%
                </span>
                <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex items-center gap-3 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <IndianRupee className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Overdue</p>
              <p className="text-base font-black text-red-600 dark:text-red-500 leading-none truncate">₹{formatCurrency(overdueRev)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[9px] font-bold ${overdueChange >= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {overdueChange > 0 ? `▲ ${Math.abs(overdueChange).toFixed(1)}%` : '— 0%'}
                </span>
                <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
              </div>
            </div>
          </div>

          {/* Collection Rate */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex items-center gap-3 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Collection Rate</p>
              <p className="text-base font-black text-blue-600 dark:text-blue-500 leading-none truncate">{Math.round(collectionRate)}%</p>
              
              <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 mt-1 mb-1">
                <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${collectionRate}%` }}></div>
              </div>
              
              <div className="flex items-center justify-between w-full">
                <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
                <span className={`text-[8px] font-bold ${collectionRateChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {collectionRateChange >= 0 ? '▲' : '▼'} {Math.abs(collectionRateChange).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Revenue Breakdown */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 flex flex-col shadow-sm">
            <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Revenue Breakdown</p>
            <div className="flex-1 flex items-center justify-between gap-4">
              <div className="w-20 h-20 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={35}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[8px] text-slate-500 font-bold uppercase">Total</p>
                  <p className="text-[9px] font-black text-slate-800 dark:text-white">{(totalRev + unpaidRev) > 100000 ? `${((totalRev + unpaidRev)/100000).toFixed(1)}L` : (totalRev + unpaidRev) > 1000 ? `${((totalRev + unpaidRev)/1000).toFixed(1)}k` : formatCurrency(totalRev + unpaidRev)}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2">
                {statusData.map((status) => (
                  <div key={status.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }}></div>
                      <span className="font-bold text-slate-600 dark:text-slate-300">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">₹{(status.value > 100000) ? `${(status.value/100000).toFixed(1)}L` : (status.value > 1000) ? `${(status.value/1000).toFixed(1)}k` : formatCurrency(status.value)}</span>
                      <span className="font-medium text-slate-400 w-8 text-right">({(totalRev + unpaidRev) > 0 ? Math.round((status.value / (totalRev + unpaidRev)) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Revenue Activity */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 lg:col-span-2 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Recent Revenue Activity</p>
              <button 
                onClick={() => setViewAllType('revenue')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({allActiveInvoices.length})</span>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col justify-start">
              {/* Header Row */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-white/5 mb-1">
                 <div className="w-20 text-[8px] font-bold text-slate-400 uppercase tracking-wider">Date</div>
                 <div className="flex-1 min-w-0 text-[8px] font-bold text-slate-400 uppercase tracking-wider">Source</div>
                 <div className="w-16 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">Type</div>
                 <div className="w-20 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</div>
                 <div className="w-16 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</div>
              </div>

              {recentInvoices.length > 0 ? recentInvoices.map((inv) => {
                const isPaid = inv.status === 'paid' || inv.paymentStatus === 'paid';
                return (
                <div key={inv.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                  
                  {/* Date */}
                  <div className="w-20 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                    {inv.billDate ? new Date(inv.billDate).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </div>

                  {/* Source */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors leading-tight truncate">{inv.billNumber}</p>
                  </div>

                  {/* Type */}
                  <div className="w-16 text-[9px] font-medium text-slate-500 dark:text-slate-400 text-center">
                    {isPaid ? 'Paid' : 'Unpaid'}
                  </div>

                  {/* Amount */}
                  <div className="w-20 text-[10px] font-black text-slate-900 dark:text-white text-right truncate">
                    ₹{formatCurrency(inv.grandTotal)}
                  </div>

                  {/* Status Badge */}
                  <div className="w-16 flex justify-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                        isPaid ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' :
                        isInvoiceOverdue(inv) ? 'bg-red-50 text-red-600 dark:bg-red-500/10' :
                        'bg-orange-50 text-orange-500 dark:bg-orange-500/10'
                      }`}>
                      {isPaid ? 'Paid' : isInvoiceOverdue(inv) ? 'Overdue' : 'Unpaid'}
                    </span>
                  </div>

                </div>
              )}) : (
                <div className="flex-1 flex flex-col items-center justify-center py-2 opacity-50">
                  <IndianRupee className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-[10px] font-bold text-slate-500">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Backup Modal Content ---
  const renderBackupsModal = () => {
    const total = currentMonthInvoices.filter(i => !i.isDeleted).length;
    const synced = currentMonthInvoices.filter(i => i.driveUrl && !i.isDeleted).length;
    const pending = total - synced;
    const failed = 0; // We don't currently track failed syncs explicitly
    const storageUsed = (synced * 2.45); // Assuming ~2.45MB per invoice

    const prevTotal = prevMonthInvoices.filter(i => !i.isDeleted).length;
    const prevSynced = prevMonthInvoices.filter(i => i.driveUrl && !i.isDeleted).length;
    const prevPending = prevTotal - prevSynced;
    
    const syncedChange = computePercentageChange(synced, prevSynced);
    const pendingChange = computePercentageChange(pending, prevPending);
    const totalChange = computePercentageChange(total, prevTotal);
    const prevSuccessRate = prevTotal > 0 ? (prevSynced / prevTotal) * 100 : 0;
    const successRate = total > 0 ? (synced / total) * 100 : 0;
    const successRateChange = successRate - prevSuccessRate;

    const prevMonthLabel = localMonth === 0 ? `Dec ${localYear - 1}` : new Date(localYear, localMonth - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

    const statusData = [
      { name: 'Successful', value: synced, color: '#3B82F6' },
      { name: 'Failed', value: failed, color: '#EF4444' },
      { name: 'Pending', value: pending, color: '#A855F7' },
      { name: 'Not Synced', value: 0, color: '#9CA3AF' },
    ];

    const allActiveInvoices = [...currentMonthInvoices].filter(i => !i.isDeleted);
    const recentInvoices = analyticsSearchQuery.trim()
      ? allActiveInvoices.filter(inv => {
          const q = analyticsSearchQuery.toLowerCase().trim();
          const billNo = (inv.billNumber || '').toLowerCase();
          const client = (inv.billedTo?.clientName || '').toLowerCase();
          return billNo.includes(q) || client.includes(q);
        }).slice(0, 2)
      : allActiveInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 2);

    return (
      <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-500">
        {/* HEADER SECTION */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-50 dark:from-blue-500/20 dark:to-indigo-500/10 flex items-center justify-center shadow-inner border border-white/50 dark:border-white/5">
              <CloudUpload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="pr-10 sm:pr-0">
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                Backup Analytics Overview
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium leading-tight">Sync history & success rate for {monthLabelFull}</p>
            </div>
          </div>

          {/* Right Header Cards */}
          <div className="grid grid-cols-3 sm:flex sm:flex-row flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-4 xl:mt-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Total Days</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">{new Date(localYear, localMonth + 1, 0).getDate()}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Avg. Syncs / Day</p>
                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mt-1 sm:mt-1.5">{(synced / new Date(localYear, localMonth + 1, 0).getDate()).toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white dark:bg-zinc-900/50 px-2 py-3 sm:px-5 sm:py-2.5 rounded-[1rem] sm:rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/5 w-full sm:w-auto sm:min-w-[130px] justify-center sm:justify-start text-center sm:text-left">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
              </div>
              <div className="flex flex-col items-center sm:items-start w-full overflow-hidden">
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase leading-none truncate w-full">Success Rate</p>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-1.5 mt-1 sm:mt-1.5 leading-none">
                  <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{Math.round(successRate)}%</span>
                  <span className={`text-[9px] sm:text-[10px] font-bold ${successRateChange >= 0 ? 'text-emerald-500' : 'text-red-500'} whitespace-nowrap`}>
                    {successRateChange >= 0 ? '▲' : '▼'} {Math.abs(successRateChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GRAPH SECTION */}
        <div className="w-full glass-panel rounded-xl sm:rounded-2xl p-3 bg-white/70 dark:bg-zinc-900/70 border border-white dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-2">
            
            {/* Sync Activity Title (Left side where Daily/Weekly was) */}
            <div className="flex items-center justify-between w-full md:w-auto">
               <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider mr-4">Sync Activity Over Time</p>
               <div className="flex md:hidden items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl">
                  <button onClick={() => setChartView('daily')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all shadow-sm ${chartView === 'daily' ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}>Daily</button>
                  <button onClick={() => setChartView('weekly')} className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all shadow-sm ${chartView === 'weekly' ? 'bg-blue-100 text-blue-600' : 'text-slate-500'}`}>Weekly</button>
               </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Successful Syncs
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  Failed Syncs
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                  Pending Syncs
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl mr-2">
                 <button onClick={() => setChartView('daily')} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'daily' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}>Daily</button>
                 <button onClick={() => setChartView('weekly')} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm ${chartView === 'weekly' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white shadow-none bg-transparent'}`}>Weekly</button>
              </div>

              <div className="flex gap-1.5 items-center">
                <div className={cn(
                  "flex items-center gap-2 bg-slate-100 dark:bg-zinc-950 rounded-xl border transition-all duration-300 ease-out origin-right overflow-hidden",
                  showSearch 
                    ? "w-44 sm:w-64 md:w-72 px-2.5 py-1 opacity-100 scale-x-100 border-slate-200 dark:border-white/10" 
                    : "w-0 px-0 py-0 opacity-0 scale-x-90 border-transparent pointer-events-none"
                )}>
                  <Search className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search Client, Bill No, Sync status..."
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none w-full min-w-[120px]"
                    ref={(input) => { if (showSearch && input) input.focus(); }}
                  />
                  {analyticsSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setAnalyticsSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => {
                    if (showSearch) {
                      setShowSearch(false);
                      setAnalyticsSearchQuery("");
                    } else {
                      setShowSearch(true);
                    }
                  }} 
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-md border text-slate-400 cursor-pointer transition-all shrink-0 active:scale-95",
                    showSearch ? "bg-blue-600 text-white border-blue-600 shadow-xs" : "border-slate-200 dark:border-white/10 hover:text-slate-600 hover:bg-slate-50 dark:hover:text-white"
                  )}
                  title={showSearch ? "Close Search" : "Search Sync Activity"}
                >
                  {showSearch ? <X className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => handleExportCSV('backups')} 
                  className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 cursor-pointer transition-all shrink-0 active:scale-95"
                  title="Export Month Cloud Sync CSV Report"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="h-32 sm:h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={chartView === 'weekly' ? weeklyData : dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSynced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(59, 130, 246, 0.1)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const syncedCount = payload.find(p => p.dataKey === 'synced')?.value as number || 0;
                      // Pending is total count - synced
                      const totalCount = payload[0].payload.count;
                      const pendingCount = Math.max(0, totalCount - syncedCount);
                      const failedCount = 0;

                      return (
                        <div className="bg-slate-900 dark:bg-black text-white border border-white/10 p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-xl min-w-[140px] sm:min-w-[200px]" style={{ color: 'white' }}>
                          <p className="font-bold text-[10px] sm:text-xs mb-1.5 sm:mb-3 pb-1.5 sm:pb-3 border-b border-white/10 text-white">{payload[0].payload.dateFull}</p>
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Successful Syncs</span>
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-white">{syncedCount}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Failed Syncs</span>
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-white">{failedCount}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:gap-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-violet-500"></div>
                                <span className="text-[9px] sm:text-xs text-slate-300">Pending Syncs</span>
                              </div>
                              <span className="text-[11px] sm:text-sm font-bold text-white">{pendingCount}</span>
                            </div>
                            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between gap-3 sm:gap-4">
                              <span className="text-[9px] sm:text-xs text-slate-300">Total Syncs</span>
                              <span className="text-[11px] sm:text-sm font-bold text-white">{syncedCount + pendingCount + failedCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Pending Syncs (Bars) */}
                <Bar yAxisId="left" dataKey={(d) => Math.max(0, d.count - d.synced)} fill="#A855F7" radius={[4, 4, 0, 0]} maxBarSize={chartView === 'weekly' ? 40 : 10}>
                  {(chartView === 'weekly' ? weeklyData : dailyData).map((entry, index) => {
                    const pend = Math.max(0, entry.count - entry.synced);
                    return <Cell key={`cell-${index}`} fillOpacity={pend > 0 ? 0.6 : 0} />;
                  })}
                </Bar>
                
                {/* Failed Syncs (Bars - virtually empty for now) */}
                <Bar yAxisId="left" dataKey={() => 0} fill="#EF4444" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={10} />

                {/* Successful Syncs (Area + Line) */}
                <Area yAxisId="left" type="monotone" dataKey="synced" fill="url(#colorSynced)" stroke="none" />
                <Line yAxisId="left" type="monotone" dataKey="synced" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SUMMARY CARDS (5 cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Synced Files */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex flex-col items-center text-center gap-1 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <CloudUpload className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Synced Files</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{synced}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-[9px] font-bold ${syncedChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {syncedChange >= 0 ? '▲' : '▼'} {Math.abs(syncedChange).toFixed(1)}%
              </span>
              <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
            </div>
          </div>

          {/* Pending Sync */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex flex-col items-center text-center gap-1 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <RefreshCcw className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Pending Sync</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{pending}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-[9px] font-bold ${pendingChange <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {pendingChange <= 0 ? '▼' : '▲'} {Math.abs(pendingChange).toFixed(1)}%
              </span>
              <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
            </div>
          </div>

          {/* Failed Sync */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex flex-col items-center text-center gap-1 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Failed Sync</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{failed}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[9px] font-bold text-slate-400">— 0%</span>
              <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
            </div>
          </div>

          {/* Total Files */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex flex-col items-center text-center gap-1 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Files</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{total}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-[9px] font-bold ${totalChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalChange >= 0 ? '▲' : '▼'} {Math.abs(totalChange).toFixed(1)}%
              </span>
              <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
            </div>
          </div>

          {/* Storage Used */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 flex flex-col items-center text-center gap-1 border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <DownloadCloud className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Storage Used</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{storageUsed.toFixed(2)} <span className="text-[10px]">MB</span></p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-[9px] font-bold ${syncedChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {syncedChange >= 0 ? '▲' : '▼'} {Math.abs(syncedChange).toFixed(1)}%
              </span>
              <span className="text-[8px] text-slate-400 truncate">vs {prevMonthLabel}</span>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Backup Health Overview */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 flex flex-col shadow-sm">
            <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Backup Health Overview</p>
            <div className="flex-1 flex items-center justify-between gap-4">
              <div className="w-20 h-20 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={35}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] font-black text-slate-800 dark:text-white">{total > 0 ? Math.round((synced / total) * 100) : 0}%</p>
                  <p className="text-[7px] text-slate-500 font-bold uppercase">Healthy</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-1.5">
                {statusData.map((status) => (
                  <div key={status.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }}></div>
                      <span className="font-bold text-slate-600 dark:text-slate-300">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white">{status.value}</span>
                      <span className="font-medium text-slate-400 w-6 text-right">({total > 0 ? Math.round((status.value / total) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Health Banner */}
            <div className="mt-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-2 flex items-center gap-2">
               <RefreshCcw className="w-3 h-3 text-blue-600 dark:text-blue-400" />
               <p className="text-[9px] font-bold text-blue-800 dark:text-blue-300">All your files are synced and secure 🚀</p>
            </div>
          </div>

          {/* Recent Sync Activity */}
          <div className="glass-panel p-3 rounded-xl bg-white dark:bg-zinc-900/50 border border-slate-100 dark:border-white/5 lg:col-span-2 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-wider">Recent Sync Activity</p>
              <button 
                onClick={() => setViewAllType('backups')}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({allActiveInvoices.length})</span>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col justify-start">
              {/* Header Row */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-white/5 mb-1">
                 <div className="w-24 text-[8px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</div>
                 <div className="flex-1 min-w-0 text-[8px] font-bold text-slate-400 uppercase tracking-wider">File / Source</div>
                 <div className="w-16 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</div>
                 <div className="w-16 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-right">Size</div>
                 <div className="w-16 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-right">Duration</div>
              </div>

              {recentInvoices.length > 0 ? recentInvoices.map((inv) => {
                const isSynced = !!inv.driveUrl;
                return (
                <div key={inv.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                  
                  {/* Date & Time */}
                  <div className="w-24 text-[9px] font-bold text-slate-600 dark:text-slate-300 truncate pr-1">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>

                  {/* File / Source */}
                  <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center flex-shrink-0">
                       <CloudUpload className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                       <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-tight truncate">{inv.billNumber}.pdf</p>
                       <p className="text-[8px] text-slate-500 truncate leading-tight">Google Drive</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="w-16 flex justify-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                        isSynced ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-violet-50 text-violet-600 dark:bg-violet-500/10'
                      }`}>
                      {isSynced ? 'Synced' : 'Pending'}
                    </span>
                  </div>
                  
                  {/* Size */}
                  <div className="w-16 text-[9px] font-bold text-slate-700 dark:text-slate-300 text-right truncate">
                    {isSynced ? '2.45 MB' : '-'}
                  </div>

                  {/* Duration */}
                  <div className="w-16 text-[9px] font-medium text-slate-500 text-right truncate">
                    {isSynced ? '2.34 sec' : '-'}
                  </div>

                </div>
              )}) : (
                <div className="flex-1 flex flex-col items-center justify-center py-2 opacity-50">
                  <CloudUpload className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-[10px] font-bold text-slate-500">No recent syncs</p>
                </div>
              )}
            </div>
            
            {/* Bottom Safe Banner */}
            <div className="mt-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300">Your backups are safe and up to date.</p>
               </div>
               <div className="w-4 h-4 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!activeModal) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Flex-Col Modal Container (Fixed height flex layout so scrolling happens STRICTLY inside content body) */}
      <div className="relative w-full max-w-6xl h-[85vh] sm:h-[90vh] max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl border border-white/40 dark:border-white/10 animate-in zoom-in-95 duration-300">

        {/* Mobile-only Absolute Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:hidden p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full shadow-md border border-slate-200 dark:border-white/10 z-50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-slate-700 dark:text-zinc-300 stroke-[2.5px]" />
        </button>

        {/* Desktop Header Ribbon (Fixed Top Flex Item) */}
        <div className="flex-shrink-0 hidden sm:flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {/* macOS dots removed */}
          </div>

          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-1.5 sm:gap-2">
            <button disabled={!canGoPrev} onClick={handlePrevMonth} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm border ${canGoPrev ? 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10' : 'bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed'}`}>
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            </button>
            <div className="bg-white dark:bg-white/5 px-4 py-1.5 rounded-full text-xs font-bold text-slate-700 dark:text-zinc-300 min-w-[100px] text-center border border-slate-200 dark:border-white/10 shadow-sm">
              {new Date(localYear, localMonth).toLocaleString('en-US', { month: 'short', year: 'numeric' })}
            </div>
            <button disabled={!canGoNext} onClick={handleNextMonth} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm border ${canGoNext ? 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10' : 'bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed'}`}>
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Content Body (SCROLLABLE FLEX-1 AREA - Scrolls strictly inside the modal container) */}
        <div className="flex-1 overflow-y-auto p-3.5 pt-10 sm:p-8 sm:pt-8 space-y-4 select-none scrollbar-thin scrollbar-thumb-violet-400/40 hover:scrollbar-thumb-violet-500/60 scrollbar-track-transparent">
          {activeModal === 'invoices' && renderInvoicesModal()}
          {activeModal === 'revenue' && renderRevenueModal()}
          {activeModal === 'backups' && renderBackupsModal()}
        </div>

        {/* Mobile Date Navigation Fixed Footer (Fixed Bottom Flex Item) */}
        <div className="flex-shrink-0 sm:hidden flex items-center justify-center p-2.5 border-t border-slate-200 dark:border-white/5 bg-slate-50/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2.5">
            <button disabled={!canGoPrev} onClick={handlePrevMonth} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm border ${canGoPrev ? 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10' : 'bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed'}`}>
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            </button>
            <div className="bg-white dark:bg-white/5 px-5 py-1.5 rounded-full text-xs font-bold text-slate-700 dark:text-zinc-300 min-w-[110px] text-center border border-slate-200 dark:border-white/10 shadow-sm">
              {new Date(localYear, localMonth).toLocaleString('en-US', { month: 'short', year: 'numeric' })}
            </div>
            <button disabled={!canGoNext} onClick={handleNextMonth} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm border ${canGoNext ? 'bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10' : 'bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed'}`}>
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderViewAllCanvas = () => {
    if (!viewAllType) return null;

    const allActive = currentMonthInvoices.filter(i => !i.isDeleted);
    const filteredCanvasInvoices = canvasSearchQuery.trim()
      ? allActive.filter(inv => {
          const q = canvasSearchQuery.toLowerCase().trim();
          const billNo = (inv.billNumber || '').toLowerCase();
          const client = (inv.billedTo?.clientName || '').toLowerCase();
          const gstin = (inv.billedTo?.clientGstin || '').toLowerCase();
          const amt = (inv.grandTotal || 0).toString();
          return billNo.includes(q) || client.includes(q) || gstin.includes(q) || amt.includes(q);
        })
      : allActive.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const titleMap = {
      invoices: 'All Invoice Activities',
      revenue: 'All Revenue Transactions',
      backups: 'All Cloud Sync Backups'
    };

    const colorMap = {
      invoices: 'text-violet-600 bg-violet-100 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-500/30',
      revenue: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
      backups: 'text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999999] bg-slate-900/80 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none">
        <div className="w-full max-w-4xl bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
          
          {/* Canvas Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", colorMap[viewAllType])}>
                {viewAllType === 'invoices' ? <FileText className="w-5 h-5" /> :
                 viewAllType === 'revenue' ? <IndianRupee className="w-5 h-5" /> :
                 <CloudUpload className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {titleMap[viewAllType]}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  {monthLabelFull} • Showing {filteredCanvasInvoices.length} of {allActive.length} items
                </p>
              </div>
            </div>

            {/* Canvas Actions & Close */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {/* Search Bar in Canvas */}
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 flex-1 sm:w-60 shadow-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={canvasSearchQuery}
                  onChange={(e) => setCanvasSearchQuery(e.target.value)}
                  placeholder="Filter records..."
                  className="bg-transparent text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none w-full"
                  autoFocus
                />
                {canvasSearchQuery && (
                  <button onClick={() => setCanvasSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button 
                onClick={() => handleExportCSV(viewAllType)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button 
                onClick={() => setViewAllType(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Scrollable Table Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10">
            {filteredCanvasInvoices.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredCanvasInvoices.map((inv) => {
                  const isPaid = inv.status === 'paid' || inv.paymentStatus === 'paid';
                  const overdue = isInvoiceOverdue(inv);

                  return (
                    <div 
                      key={inv.id} 
                      className="py-3 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs",
                          isPaid ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" :
                          overdue ? "bg-red-100 text-red-600 dark:bg-red-500/20" :
                          "bg-orange-100 text-orange-600 dark:bg-orange-500/20"
                        )}>
                          {isPaid ? <CheckCircle2 className="w-4 h-4" /> :
                           overdue ? <AlertCircle className="w-4 h-4" /> :
                           <Clock className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                              {inv.billNumber || 'Draft'}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold",
                              isPaid ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" :
                              overdue ? "bg-red-50 text-red-600 dark:bg-red-500/10" :
                              "bg-orange-50 text-orange-500 dark:bg-orange-500/10"
                            )}>
                              {isPaid ? 'Paid' : overdue ? 'Overdue' : 'Pending'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500">
                              {inv.isImported || inv.invoiceType === 'imported' ? 'Imported' : 'Manual'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                            {inv.billedTo?.clientName || 'Unknown Client'} {inv.billedTo?.clientGstin ? `• GST: ${inv.billedTo.clientGstin}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-white/5">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-slate-400 font-medium">
                            {inv.billDate ? new Date(inv.billDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </p>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            ₹{formatCurrency(inv.grandTotal || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">No records matching &quot;{canvasSearchQuery}&quot;</p>
              </div>
            )}
          </div>

          {/* Canvas Footer */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-zinc-400">
            <span>Total Records: {filteredCanvasInvoices.length}</span>
            <span className="text-slate-900 dark:text-white font-black">
              Total Amount: ₹{formatCurrency(filteredCanvasInvoices.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0))}
            </span>
          </div>

        </div>
      </div>,
      document.body
    );
  };

  if (typeof document !== 'undefined') {
    return (
      <>
        {createPortal(modalContent, document.body)}
        {renderViewAllCanvas()}
      </>
    );
  }

  return (
    <>
      {modalContent}
      {renderViewAllCanvas()}
    </>
  );
};
