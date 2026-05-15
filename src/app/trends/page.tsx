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

export default function TrendsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState<any | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trends')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Lỗi tải dữ liệu trends");
    } else {
      setTrends(data || []);
    }
    setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Quản lý Trends</h2>
        <Button onClick={fetchTrends} variant="outline" disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Trends do AI phát hiện</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={trend.id}>
                  <TableCell className="font-medium cursor-pointer text-blue-600 hover:underline" onClick={() => setSelectedTrend(trend)}>
                    {trend.trend_name}
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
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">🔥 Lý do Viral</h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-md border text-sm">{selectedTrend?.viral_reason}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">💡 Ý tưởng Content cho KOL</h4>
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
