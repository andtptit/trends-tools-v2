"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Users, Video, BarChart2, Lightbulb, Flame, BrainCircuit, Trash2 } from "lucide-react";

export default function TrendsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trends')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Lỗi tải dữ liệu trends");
    } else {
      setTrends(data || []);
      setSelectedIds(new Set());
    }
    setLoading(false);
  };

  const handleAnalyze = async () => {
    toast.info("Đang chạy AI phân tích dữ liệu mới, vui lòng đợi...");
    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Phân tích hoàn tất!");
        fetchTrends();
      } else {
        toast.error(data.error || "Có lỗi khi phân tích");
      }
    } catch (e) {
      toast.error("Lỗi kết nối API AI");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('trends')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error("Lỗi cập nhật trạng thái");
    } else {
      toast.success(`Đã chuyển trạng thái thành ${newStatus}`);
      fetchTrends();
      if (newStatus === 'approved') {
        toast.info("Đang gửi thông báo lên Telegram...");
        fetch('/api/telegram/send', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trendId: id }) 
        }).then(res => res.json()).then(data => {
            if (data.error) toast.error("Lỗi gửi Telegram: " + data.error);
            else toast.success("Đã gửi Telegram thành công!");
        }).catch(() => toast.error("Lỗi gọi API Telegram"));
      }
    }
  };

  const handleDeleteTrend = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa trend này không?")) return;
    
    setDeletingId(id);
    try {
      const { error } = await supabase.from('trends').delete().eq('id', id);
      if (error) throw error;
      toast.success("Đã xóa trend thành công");
      fetchTrends();
    } catch (e) {
      toast.error("Lỗi khi xóa trend");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} trend đã chọn?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('trends')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`Đã xóa ${selectedIds.size} trend thành công`);
      setSelectedIds(new Set());
      fetchTrends();
    } catch (e: any) {
      toast.error("Lỗi khi xóa hàng loạt: " + e.message);
    } finally {
      setLoading(false);
    }
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
    if (selectedIds.size === trends.length && trends.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trends.map(t => t.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Quản lý Trends</h2>
          <p className="text-sm text-gray-500">Duyệt và tối ưu các xu hướng do AI phát hiện</p>
        </div>
        <div className="flex gap-3">
            {selectedIds.size > 0 && (
                <Button onClick={handleDeleteBulk} variant="outline" className="h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa ({selectedIds.size})
                </Button>
            )}
            <Button onClick={handleAnalyze} variant="default" disabled={loading} className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-100">
               <BrainCircuit className="w-4 h-4 mr-2" />
               {loading ? 'Đang xử lý...' : 'Phân tích AI ngay'}
            </Button>
            <Button onClick={fetchTrends} variant="outline" className="h-10" disabled={loading}>
               Làm mới
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Trends do AI phát hiện</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 cursor-pointer"
                    checked={trends.length > 0 && selectedIds.size === trends.length}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Tên Trend</TableHead>
                <TableHead>Điểm</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trends.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">Chưa có trend nào. Hãy kích hoạt bot cào và AI.</TableCell></TableRow>
              ) : trends.map((trend) => (
                <TableRow key={trend.id} className={selectedIds.has(trend.id) ? "bg-blue-50/50" : ""}>
                  <TableCell className="text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer"
                      checked={selectedIds.has(trend.id)}
                      onChange={() => toggleSelection(trend.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium cursor-pointer text-blue-600 hover:underline" onClick={() => setSelectedTrend(trend)}>
                    <div className="flex flex-col gap-1">
                      {trend.categories ? (
                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 inline-block w-fit px-2 py-0.5 rounded">
                          {trend.categories.name}
                        </span>
                      ) : null}
                      <span>{trend.trend_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={trend.trend_score >= 80 ? "destructive" : "secondary"}>{trend.trend_score}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={trend.status === 'approved' ? "default" : trend.status === 'rejected' ? "destructive" : "outline"}>
                      {trend.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {format(new Date(trend.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {trend.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="default" onClick={() => updateStatus(trend.id, 'approved')}>Duyệt</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(trend.id, 'rejected')}>Bỏ qua</Button>
                      </div>
                    )}
                    <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={deletingId === trend.id}
                        onClick={() => handleDeleteTrend(trend.id)}
                      >
                         <Trash2 className="w-4 h-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal chi tiết */}
      <Dialog open={!!selectedTrend} onOpenChange={(open) => !open && setSelectedTrend(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl leading-tight">{selectedTrend?.trend_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-4 p-3 bg-purple-50 rounded-lg border border-purple-100 text-purple-900">
                <div className="flex items-center gap-2 font-medium">
                   <Video className="w-4 h-4 text-purple-600" />
                   {selectedTrend?.videos_count || 1} video tham gia
                </div>
                <div className="flex items-center gap-2 font-medium">
                   <Users className="w-4 h-4 text-purple-600" />
                   {selectedTrend?.channels_count || 1} kênh lan truyền
                </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500"/> Lý do Viral</h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-md border text-sm">{selectedTrend?.viral_reason}</p>
            </div>

            {selectedTrend?.channel_stats && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-blue-500"/> Thống kê các Kênh</h4>
              <p className="text-gray-700 bg-blue-50/50 p-4 rounded-md border border-blue-100 text-sm whitespace-pre-wrap">{selectedTrend?.channel_stats}</p>
            </div>
            )}

            {selectedTrend?.expert_commentary && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-purple-500"/> Nhận xét từ AI Chuyên gia</h4>
              <p className="text-gray-700 bg-purple-50/50 p-4 rounded-md border border-purple-100 text-sm italic">"{selectedTrend?.expert_commentary}"</p>
            </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500"/> Ý tưởng Content cho KOL</h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-md border text-sm whitespace-pre-wrap">{selectedTrend?.content_ideas}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
               {selectedTrend?.status === 'pending' && (
                  <>
                    <Button variant="default" onClick={() => { updateStatus(selectedTrend.id, 'approved'); setSelectedTrend(null); }}>Duyệt ngay</Button>
                    <Button variant="destructive" onClick={() => { updateStatus(selectedTrend.id, 'rejected'); setSelectedTrend(null); }}>Từ chối</Button>
                  </>
               )}
               <Button variant="outline" onClick={() => setSelectedTrend(null)}>Đóng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
