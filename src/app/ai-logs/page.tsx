"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Brain, Search, Info } from "lucide-react";

export default function AILogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_logs')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (data) setLogs(data);
    setLoading(false);
  };

  const openLogDetails = (log: any) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Nhật ký AI</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Số bài xử lý</TableHead>
                  <TableHead>Trend tìm thấy</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={6} className="text-center py-10">Đang tải dữ liệu...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-500">Chưa có lịch sử phân tích nào.</TableCell></TableRow>
                ) : logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {format(new Date(log.created_at), 'HH:mm dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      {log.categories ? (
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded">{log.categories.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Toàn cầu</span>
                      )}
                    </TableCell>
                    <TableCell>{log.items_analyzed}</TableCell>
                    <TableCell>{log.trends_found}</TableCell>
                    <TableCell>
                      {log.status === 'success' ? (
                         <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Thành công</Badge>
                      ) : log.status === 'processing' ? (
                         <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Đang xử lý</Badge>
                      ) : (
                         <Badge variant="destructive">Lỗi</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       <button onClick={() => openLogDetails(log)} className="text-blue-600 hover:text-blue-800 p-2">
                          <Info className="w-5 h-5" />
                       </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Chi tiết */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Chi tiết Phiên Phân tích
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md border">
                <div>
                   <p className="text-xs text-gray-500">Trạng thái tiến trình:</p>
                   <p className="font-semibold">{selectedLog?.status === 'success' ? '✅ Chạy xong' : selectedLog?.status === 'processing' ? '⏳ Đang xử lý...' : '❌ Có lỗi'}</p>
                </div>
                <div>
                   <p className="text-xs text-gray-500">Model phân tích:</p>
                   <p className="font-semibold">Gemini 2.5 Flash</p>
                </div>
                <div>
                   <p className="text-xs text-gray-500">Số lượng Trends trả về:</p>
                   <p className="font-semibold text-purple-600">{selectedLog?.trends_found || 0} trends</p>
                </div>
                <div>
                   <p className="text-xs text-gray-500">Token đã dùng:</p>
                   <p className="font-semibold text-blue-600">{
                      selectedLog?.tokens_used 
                        ? selectedLog.tokens_used.toLocaleString() 
                        : (selectedLog?.response_raw?.match(/Tokens.*?: ([\d,]+)/)?.[1] || 'N/A')
                   }</p>
                </div>
             </div>

             <div>
                <h4 className="font-semibold mb-2">Prompt đã sử dụng:</h4>
                <div className="bg-gray-100 p-4 rounded-md text-xs text-gray-700 whitespace-pre-wrap font-mono">
                   {selectedLog?.prompt_used || 'Không có dữ liệu'}
                </div>
             </div>

             {selectedLog?.response_raw && (
                <div>
                   <h4 className="font-semibold mb-2 text-green-600">Phản hồi từ Gemini (Raw JSON):</h4>
                   <div className="bg-slate-900 text-slate-100 p-4 rounded-md text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {typeof selectedLog.response_raw === 'string' 
                         ? selectedLog.response_raw 
                         : JSON.stringify(selectedLog.response_raw, null, 2)}
                   </div>
                </div>
             )}

             {selectedLog?.error_message && (
                <div>
                   <h4 className="font-semibold mb-2 text-red-600">Chi tiết Lỗi:</h4>
                   <div className="bg-red-50 text-red-700 p-4 rounded-md border border-red-200 text-xs font-mono">
                      {selectedLog.error_message}
                   </div>
                </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
