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
import { Users, Video, BarChart2, Lightbulb, Flame, BrainCircuit, Trash2, Activity, Send } from "lucide-react";

export default function TrendsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewTrend, setPreviewTrend] = useState<any | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [telegramGroups, setTelegramGroups] = useState<any[]>([]);
  const [selectedGroupChatIds, setSelectedGroupChatIds] = useState<string[]>([]);
  const [previewAction, setPreviewAction] = useState<'approve' | 'resend'>('approve');
  const supabase = createClient();

  // AI Memory Reject States
  const [rejectTrend, setRejectTrend] = useState<any | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [saveToMemory, setSaveToMemory] = useState(true);
  const [rejectRuleType, setRejectRuleType] = useState("grouping");
  const [isRejecting, setIsRejecting] = useState(false);


  useEffect(() => {
    fetchTrends();
    fetchTelegramGroups();
  }, []);

  const fetchTelegramGroups = async () => {
    const { data } = await supabase.from('telegram_groups').select('chat_id, group_name');
    if (data) setTelegramGroups(data);
  };

  const fetchTrends = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trends')
      .select('*, categories(name)')
      .neq('status', 'analyzed')
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

  const handleResend = async (id: string, chatIds: string[]) => {
    toast.info("Đang gửi lại thông báo lên Telegram...");
    try {
      const res = await fetch('/api/telegram/send', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trendId: id, chatIds }) 
      });
      const data = await res.json();
      if (data.error) toast.error("Lỗi gửi Telegram: " + data.error);
      else toast.success("Đã gửi Telegram thành công!");
    } catch (e) {
      toast.error("Lỗi gọi API Telegram");
    }
  };

  const updateStatus = async (id: string, newStatus: string, chatIds?: string[]) => {
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
            body: JSON.stringify({ trendId: id, chatIds }) 
        }).then(res => res.json()).then(data => {
            if (data.error) toast.error("Lỗi gửi Telegram: " + data.error);
            else toast.success("Đã gửi Telegram thành công!");
        }).catch(() => toast.error("Lỗi gọi API Telegram"));
      }
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTrend) return;
    setIsRejecting(true);
    try {
      // 1. Cập nhật trạng thái trend sang rejected và lưu lý do từ chối
      const { error: updateError } = await supabase
        .from('trends')
        .update({ 
          status: 'rejected',
          reject_reason: rejectFeedback.trim() || null
        })
        .eq('id', rejectTrend.id);

      if (updateError) {
        toast.error("Lỗi cập nhật trạng thái");
        setIsRejecting(false);
        return;
      }

      // 2. Nếu tích chọn Lưu vào bộ nhớ AI
      if (saveToMemory && rejectFeedback.trim()) {
        const { error: insertError } = await supabase
          .from('ai_feedback_memory')
          .insert({
            rule_type: rejectRuleType,
            user_feedback: rejectFeedback.trim(),
            example_case: `Vụ việc từ chối: "${rejectTrend.trend_name}"`
          });

        if (insertError) {
          toast.error("Không thể lưu góp ý vào bộ nhớ AI: " + insertError.message);
        } else {
          toast.success("Đã ghi nhận góp ý vào bộ nhớ AI và từ chối trend!");
        }
      } else {
        toast.success("Đã từ chối trend thành công!");
      }

      setRejectTrend(null);
      setRejectFeedback("");
      fetchTrends();
    } catch (e: any) {
      toast.error("Có lỗi xảy ra: " + e.message);
    }
    setIsRejecting(false);
  };

  const openPreviewModal = async (trend: any, action: 'approve' | 'resend') => {
    setPreviewTrend(trend);
    setPreviewAction(action);
    setPreviewContent("");
    setIsPreviewLoading(true);

    const nicheChatId = trend.categories?.telegram_chat_id;
    if (nicheChatId) {
      setSelectedGroupChatIds([nicheChatId]);
    } else {
      setSelectedGroupChatIds([]);
    }
    
    try {
      // Fetch related videos to build the full preview
      let channelStatsText = "";
      if (trend.related_ids && Array.isArray(trend.related_ids) && trend.related_ids.length > 0) {
        const { data: relatedItems } = await supabase
          .from('crawled_data')
          .select('author_name, views_count, likes_count, posted_at, post_url')
          .in('id', trend.related_ids);
        
        if (relatedItems) {
          channelStatsText = relatedItems.map(item => {
            const dateStr = item.posted_at ? format(new Date(item.posted_at), 'dd/MM') : '??';
            return `• <b>${item.author_name}</b>: ${item.views_count?.toLocaleString()} view | ${item.likes_count?.toLocaleString()} tim | ${dateStr}\n  👉 <a href="${item.post_url}">Xem clip</a>`;
          }).join('\n');
        }
      } else {
        channelStatsText = `• <b>${trend.crawled_data?.author_name || 'N/A'}</b>: ${trend.crawled_data?.views_count?.toLocaleString()} view\n  👉 <a href="${trend.crawled_data?.post_url}">Xem clip</a>`;
      }

      const fixNL = (text: string) => text ? text.replace(/\\n/g, '\n') : '';

      const content = `🔥 <b>XU HƯỚNG MỚI: ${trend.trend_name}</b>
⚡️ Độ hot: ${trend.trend_score}/100

📊 <b>THỐNG KÊ 24H QUA:</b>
- Số video tham gia: ${trend.videos_count || 1} video
- Số kênh lan truyền: ${trend.channels_count || 1} kênh
- Chi tiết nguồn tham khảo:
${channelStatsText}

💡 <b>LÝ DO VIRAL:</b>
${fixNL(trend.viral_reason)}

🧐 <b>NHẬN XÉT TỪ AI CHUYÊN GIA:</b>
${fixNL(trend.expert_commentary)}

🎯 <b>GỢI Ý HOOK 3S ĐẦU:</b>
${fixNL(trend.content_ideas)}`;

      setPreviewContent(content);
    } catch (e) {
      toast.error("Lỗi khi tải bản xem trước");
    } finally {
      setIsPreviewLoading(false);
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
        <CardContent className="p-0">
          <div className="rounded-none border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-12 text-center px-4">
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
                  <TableCell className="relative overflow-visible">
                    <div className="relative group inline-block cursor-help hover:z-50">
                      <Badge variant={trend.trend_score >= 80 ? "destructive" : "secondary"}>
                        {trend.trend_score}
                      </Badge>
                      
                      {/* Hover Tooltip Breakdown */}
                      <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl w-72 border border-slate-800 pointer-events-none space-y-2 text-left leading-relaxed">
                        <div className="font-bold text-xs border-b border-slate-800 pb-1.5 flex justify-between items-center text-purple-400">
                          <span>📊 Chi tiết điểm số</span>
                          <span>Độ hot: {trend.trend_score}/100</span>
                        </div>
                        {trend.score_breakdown ? (
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span>1. Điểm Tốc độ (Velocity):</span>
                              <span className="font-semibold text-white">{trend.score_breakdown.velocity_score}/100</span>
                            </div>
                            <div className="flex justify-between">
                              <span>2. Điểm Tương tác (Engagement):</span>
                              <span className="font-semibold text-white">{trend.score_breakdown.engagement_score}/100</span>
                            </div>
                            <div className="flex justify-between text-slate-400 pl-2">
                              <span>↳ Điểm Định lượng ({trend.score_breakdown.velocity_weight}% Tốc độ + {trend.score_breakdown.engagement_weight}% Tương tác):</span>
                              <span className="font-semibold text-slate-200">{trend.score_breakdown.quantitative_score}/100</span>
                            </div>
                            <div className="flex justify-between">
                              <span>3. Điểm Định tính (AI Qualitative):</span>
                              <span className="font-semibold text-white">{trend.score_breakdown.ai_score}/100</span>
                            </div>
                            <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-white text-xs">
                              <span>Kết quả ({trend.score_breakdown.quantitative_weight}% Định lượng + {trend.score_breakdown.ai_weight}% AI):</span>
                              <span className="text-orange-400">{trend.trend_score}/100</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">
                            Trend được tạo trước phiên bản 2.0. Không có dữ liệu phân tích chi tiết.
                          </div>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={trend.status === 'approved' ? "default" : trend.status === 'rejected' ? "destructive" : "outline"}>
                      {trend.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {format(new Date(trend.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                    <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {trend.status === 'pending' && (
                        <>
                          <Button size="sm" variant="default" className="h-8 bg-green-600 hover:bg-green-700" onClick={() => openPreviewModal(trend, 'approve')}>Duyệt</Button>
                          <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setRejectTrend(trend); setRejectFeedback(""); }}>Bỏ qua</Button>
                        </>
                      )}
                      {trend.status === 'approved' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100"
                          title="Gửi lại Telegram"
                          onClick={(e) => { e.stopPropagation(); openPreviewModal(trend, 'resend'); }}
                        >
                           <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          disabled={deletingId === trend.id}
                          onClick={() => handleDeleteTrend(trend.id)}
                        >
                           <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
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
              <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500"/> Gợi ý Hook 3s đầu cho Video</h4>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-md border text-sm whitespace-pre-wrap">{selectedTrend?.content_ideas}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
               {selectedTrend?.status === 'pending' && (
                  <>
                     <Button variant="default" onClick={() => { openPreviewModal(selectedTrend, 'approve'); setSelectedTrend(null); }}>Duyệt</Button>
                     <Button variant="destructive" onClick={() => { setRejectTrend(selectedTrend); setSelectedTrend(null); setRejectFeedback(""); }}>Từ chối</Button>
                  </>
               )}
               <Button variant="outline" onClick={() => setSelectedTrend(null)}>Đóng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Preview Telegram */}
      <Dialog open={!!previewTrend} onOpenChange={(open) => !open && setPreviewTrend(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Xem trước tin nhắn Telegram
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-900 text-white p-6 rounded-xl font-mono text-[13px] leading-relaxed max-h-[400px] overflow-y-auto shadow-inner border border-slate-800">
               {isPreviewLoading ? (
                 <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-400">Đang tạo bản xem trước...</span>
                 </div>
               ) : (
                 <div dangerouslySetInnerHTML={{ __html: previewContent.replace(/\n/g, '<br/>') }} />
               )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Gửi đến các nhóm Telegram:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-3 rounded-lg bg-gray-50">
                {telegramGroups.length === 0 ? (
                  <p className="text-xs text-gray-500 italic col-span-2">Chưa cấu hình nhóm Telegram nào. Hãy cấu hình ở mục Nhóm Telegram.</p>
                ) : (
                  telegramGroups.map((g) => (
                    <label key={g.chat_id} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupChatIds.includes(g.chat_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupChatIds([...selectedGroupChatIds, g.chat_id]);
                          } else {
                            setSelectedGroupChatIds(selectedGroupChatIds.filter(id => id !== g.chat_id));
                          }
                        }}
                        className="w-4 h-4 cursor-pointer rounded"
                      />
                      <span>{g.group_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 italic flex items-center gap-2">
                <Lightbulb className="w-3 h-3" />
                Mẹo: Bạn nên kiểm tra kỹ các link video trước khi duyệt để đảm bảo chất lượng tin nhắn.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
             <Button variant="outline" onClick={() => setPreviewTrend(null)}>Quay lại</Button>
             <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={async () => {
                   if (previewAction === 'approve') {
                     await updateStatus(previewTrend.id, 'approved', selectedGroupChatIds);
                   } else {
                     await handleResend(previewTrend.id, selectedGroupChatIds);
                   }
                   setPreviewTrend(null);
                }}
             >
                {previewAction === 'approve' ? 'Xác nhận & Gửi Telegram' : 'Gửi lại Telegram'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal từ chối & góp ý AI */}
      <Dialog open={!!rejectTrend} onOpenChange={(open) => !open && setRejectTrend(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Từ chối Trend & Góp ý AI
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
              <span className="font-semibold text-slate-700">Trend từ chối:</span>
              <p className="text-slate-900 mt-1 font-medium italic">"{rejectTrend?.trend_name}"</p>
            </div>

            {/* Lý do từ chối - Luôn luôn bắt buộc nhập */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-800">Lý do từ chối/bỏ qua:</label>
              <textarea 
                className="w-full h-20 p-2.5 rounded-md border text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
                placeholder="Nhập lý do tại sao bạn bỏ qua trend này (ví dụ: tin cũ, tin nhảm, trùng lặp...)"
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
              />
            </div>

            {/* Checkbox lưu làm bài học cho AI */}
            <div className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                id="save_to_memory"
                checked={saveToMemory}
                onChange={(e) => setSaveToMemory(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="save_to_memory" className="text-sm font-semibold text-slate-800 cursor-pointer">
                Đồng thời lưu làm quy tắc học lâu dài cho AI
              </label>
            </div>

            {saveToMemory && (
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <label className="text-xs font-semibold text-gray-700">Phân loại lỗi của AI để tối ưu:</label>
                <select 
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                  value={rejectRuleType}
                  onChange={(e) => setRejectRuleType(e.target.value)}
                >
                  <option value="grouping">Gom nhóm sai (ví dụ: gộp nhiều scandal/tin tức khác nhau)</option>
                  <option value="naming">Đặt tên sai/chung chung (ví dụ: tên quá bao quát)</option>
                  <option value="region">Nhận diện vùng miền sai (ví dụ: thiếu nhãn miền Tây)</option>
                  <option value="general">Lỗi khác</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
             <Button variant="outline" onClick={() => setRejectTrend(null)} disabled={isRejecting}>Quay lại</Button>
             <Button 
                variant="destructive"
                onClick={handleRejectSubmit}
                disabled={isRejecting || !rejectFeedback.trim()}
             >
                {isRejecting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
