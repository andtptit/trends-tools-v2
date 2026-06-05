"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  Brain, 
  Info, 
  Coins, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ClipboardList, 
  RefreshCw, 
  SlidersHorizontal,
  Database,
  Trash2
} from "lucide-react";

export default function AILogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Deletion and Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; type: "single" | "bulk" } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchLogs();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name');
    if (data) setCategories(data);
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_logs')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
      .limit(100); // Tăng lên 100 phiên để thống kê chuẩn hơn
      
    if (data) setLogs(data);
    setLoading(false);
  };

  // Helper: Tính số lượng token
  const getLogTokens = (log: any) => {
    if (log?.tokens_used) return log.tokens_used;
    const match = log?.response_raw?.match(/Tokens.*?: ([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return 0;
  };

  // Helper: Ước tính chi phí (Gemini 2.5 Flash ~ $0.15/1M Tokens blend, tỷ giá 25,400)
  const calculateCost = (tokens: number) => {
    const usd = (tokens / 1000) * 0.00015;
    const vnd = usd * 25400;
    return {
      usd: usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2),
      vnd: Math.round(vnd)
    };
  };

  // Lọc danh sách logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchCategory = filterCategory === 'all' || 
        (filterCategory === 'global' && !log.category_id) || 
        log.category_id === filterCategory;
      const matchStatus = filterStatus === 'all' || log.status === filterStatus;
      return matchCategory && matchStatus;
    });
  }, [logs, filterCategory, filterStatus]);

  // Tính toán KPI Stats trên danh sách đã lọc
  const stats = useMemo(() => {
    const totalRuns = filteredLogs.length;
    const totalTokens = filteredLogs.reduce((sum, log) => sum + getLogTokens(log), 0);
    const totalCostVnd = filteredLogs.reduce((sum, log) => sum + calculateCost(getLogTokens(log)).vnd, 0);
    const successRuns = filteredLogs.filter(log => log.status === 'success').length;
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100;

    return {
      totalRuns,
      totalTokens,
      totalCostVnd,
      successRate
    };
  }, [filteredLogs]);

  const openLogDetails = (log: any) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    const allFilteredIds = filteredLogs.map(l => l.id);
    const allSelected = allFilteredIds.every(id => selectedIds.has(id));
    
    const newSelection = new Set(selectedIds);
    if (allSelected) {
      allFilteredIds.forEach(id => newSelection.delete(id));
    } else {
      allFilteredIds.forEach(id => newSelection.add(id));
    }
    setSelectedIds(newSelection);
  };

  const confirmDeleteSingle = (id: string) => {
    setDeleteTarget({ id, type: "single" });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: "bulk" });
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "single" && deleteTarget.id) {
        const { error } = await supabase.from('ai_logs').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        
        toast.success("Đã xóa nhật ký thành công");
        const newSelection = new Set(selectedIds);
        newSelection.delete(deleteTarget.id);
        setSelectedIds(newSelection);
      } else if (deleteTarget.type === "bulk") {
        const idsArray = Array.from(selectedIds);
        const { error } = await supabase.from('ai_logs').delete().in('id', idsArray);
        if (error) throw error;
        
        toast.success(`Đã xóa thành công ${idsArray.length} nhật ký`);
        setSelectedIds(new Set());
      }
      await fetchLogs();
    } catch (error: any) {
      toast.error("Lỗi khi xóa nhật ký: " + error.message);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Nhật ký AI & Thống kê chi phí</h2>
          <p className="text-sm text-gray-500">Giám sát lượng token tiêu hao, hiệu suất chạy và quản lý ngân sách Gemini API</p>
        </div>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Tải lại dữ liệu
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Runs */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-50/50 to-blue-50/10 border-l-4 border-l-blue-600">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng phiên chạy</span>
              <p className="text-2xl font-black text-slate-800">{stats.totalRuns}</p>
            </div>
            <div className="p-3 bg-blue-100/60 rounded-xl text-blue-600">
              <ClipboardList className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Tokens */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50/50 to-pink-50/10 border-l-4 border-l-purple-600">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Token tiêu hao</span>
              <p className="text-2xl font-black text-slate-800">{stats.totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100/60 rounded-xl text-purple-600">
              <Coins className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Estimated Cost */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50/50 to-teal-50/10 border-l-4 border-l-emerald-600">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chi phí ước tính</span>
              <p className="text-2xl font-black text-slate-800">~{stats.totalCostVnd.toLocaleString()} <span className="text-xs font-bold text-slate-500">VND</span></p>
            </div>
            <div className="p-3 bg-emerald-100/60 rounded-xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Success Rate */}
        <Card className="border-none shadow-sm bg-gradient-to-br from-orange-50/50 to-amber-50/10 border-l-4 border-l-orange-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tỷ lệ thành công</span>
              <p className="text-2xl font-black text-slate-800">{stats.successRate}%</p>
            </div>
            <div className="p-3 bg-orange-100/60 rounded-xl text-orange-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-3 border-b flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          Bộ lọc nhanh
        </div>
        <CardContent className="p-5 flex flex-wrap gap-4 items-center">
          {/* Category Filter */}
          <div className="flex flex-col gap-1 w-full sm:w-64">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Theo Niche</label>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">Tất cả Niche / Toàn cầu</option>
              <option value="global">Chỉ chạy Toàn cầu (không Category)</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1 w-full sm:w-48">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Trạng thái</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="success">Thành công</option>
              <option value="processing">Đang xử lý</option>
              <option value="error">Lỗi</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Selection Actions Banner */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-red-50/80 backdrop-blur border border-red-100 rounded-xl shadow-sm animate-in fade-in-50 slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100/80 rounded-lg text-red-600">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Đã chọn {selectedIds.size} nhật ký AI</p>
              <p className="text-xs text-slate-500">Các nhật ký đã chọn sẽ được xóa vĩnh viễn khỏi database</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Hủy chọn
            </button>
            <button
              onClick={confirmDeleteBulk}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg shadow-sm transition"
            >
              Xóa tất cả đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full table-fixed min-w-[850px] lg:min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(l.id))}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </TableHead>
                <TableHead className="w-44">Thời gian</TableHead>
                <TableHead className="w-36">Niche</TableHead>
                <TableHead className="w-28 text-center">Bài xử lý</TableHead>
                <TableHead className="w-28 text-center">Trend đã gộp</TableHead>
                <TableHead className="w-48">Token & Chi phí</TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
                <TableHead className="w-24 text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10">Đang tải dữ liệu...</TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-500">Không tìm thấy lịch sử phân tích nào khớp.</TableCell></TableRow>
              ) : filteredLogs.map((log) => {
                const tokens = getLogTokens(log);
                const cost = calculateCost(tokens);
                const isHighUsage = tokens >= 20000;

                return (
                  <TableRow key={log.id} className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${selectedIds.has(log.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => openLogDetails(log)}>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(log.id)}
                        onChange={() => toggleSelection(log.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      {format(new Date(log.created_at), 'HH:mm dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {log.categories ? (
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">{log.categories.name}</span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border">Toàn cầu</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-700">{log.items_analyzed}</TableCell>
                    <TableCell className="text-center font-bold text-indigo-600">{log.trends_found}</TableCell>
                    <TableCell>
                      {tokens > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-sm font-bold ${isHighUsage ? 'text-orange-600' : 'text-slate-800'}`}>
                            {tokens.toLocaleString()} <span className="text-[10px] font-medium text-slate-500">tokens</span>
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded">
                            ~{cost.vnd.toLocaleString()} VND
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">N/A</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {log.status === 'success' ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 font-bold">Thành công</Badge>
                      ) : log.status === 'processing' ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 font-bold animate-pulse">Đang xử lý</Badge>
                      ) : (
                        <Badge variant="destructive" className="font-bold flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          Lỗi
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openLogDetails(log)} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-slate-100 rounded-full transition" title="Xem chi tiết">
                          <Info className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={() => confirmDeleteSingle(log.id)} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-full transition" title="Xóa nhật ký">
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Chi tiết */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 border-b pb-3">
              <Brain className="w-5 h-5 text-purple-600" />
              Chi tiết Phiên Phân tích
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Run info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner">
              <div className="bg-white p-3 rounded-lg border border-slate-100/80 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái</span>
                <p className="font-semibold text-xs mt-1">
                  {selectedLog?.status === 'success' ? '✅ Chạy xong' : selectedLog?.status === 'processing' ? '⏳ Đang xử lý...' : '❌ Có lỗi'}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100/80 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Model phân tích</span>
                <p className="font-semibold text-xs mt-1 text-slate-700">Gemini 2.5 Flash</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100/80 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trends thu về</span>
                <p className="font-semibold text-xs mt-1 text-purple-700">{selectedLog?.trends_found || 0} trends</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100/80 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Token & Chi phí</span>
                <p className="font-bold text-xs mt-1 text-blue-600">
                  {getLogTokens(selectedLog).toLocaleString()} (~{calculateCost(getLogTokens(selectedLog)).vnd.toLocaleString()} VND)
                </p>
              </div>
            </div>

            {/* Prompt details */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-500" />
                Prompt đã gửi lên AI:
              </h4>
              <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-600 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto border border-slate-100 shadow-inner">
                {selectedLog?.prompt_used || 'Không có dữ liệu'}
              </div>
            </div>

            {/* Response details */}
            {selectedLog?.response_raw && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-sm text-emerald-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Phản hồi từ Gemini (Raw JSON / Details):
                </h4>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-80 overflow-y-auto shadow-xl border border-slate-800">
                  {typeof selectedLog.response_raw === 'string' 
                     ? selectedLog.response_raw 
                     : JSON.stringify(selectedLog.response_raw, null, 2)}
                </div>
              </div>
            )}

            {/* Error detail */}
            {selectedLog?.error_message && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Chi tiết Lỗi hệ thống:
                </h4>
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-xs font-mono">
                  {selectedLog.error_message}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận Xóa */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              Xác nhận xóa nhật ký
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn dữ liệu khỏi hệ thống.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600 leading-relaxed">
              {deleteTarget?.type === "bulk" 
                ? `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} nhật ký AI đã chọn?`
                : "Bạn có chắc chắn muốn xóa vĩnh viễn nhật ký AI này không?"
              }
            </p>
          </div>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <button
              disabled={deleting}
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                "Xác nhận xóa"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
