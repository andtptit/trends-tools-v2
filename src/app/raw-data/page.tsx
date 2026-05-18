"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrainCircuit, ExternalLink, Filter, Users, Bookmark, Clock, Hash, Music, Play, Layers, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function RawDataPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filter states
  const [categories, setCategories] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all, analyzed, unanalyzed
  const [filterTime, setFilterTime] = useState("all"); // all, 24h
  const [minFans, setMinFans] = useState("");
  const [minCollect, setMinCollect] = useState("");

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // AI Analyze Modal states
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStatusText, setAnalyzeStatusText] = useState("");

  // Hàm tính thời gian đã trôi qua (Relative Time)
  const formatRelativeTime = (dateString: string) => {
    if (!dateString) return "Không rõ";
    const now = new Date();
    const posted = new Date(dateString);
    const diffInMs = now.getTime() - posted.getTime();
    
    if (diffInMs < 0) return "Vừa xong"; // Đề phòng lỗi múi giờ

    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 60) return `${diffInMins} phút trước`;
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    return `${diffInDays} ngày trước`;
  };

  const supabase = createClient();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterStatus, filterTime, minFans, minCollect]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from('crawled_data').select('*, categories(name)');
    
    if (filterCategory !== "all") {
      query = query.eq('category_id', filterCategory);
    }

    if (filterStatus === "analyzed") {
      query = query.eq('is_analyzed', true);
    } else if (filterStatus === "unanalyzed") {
      query = query.eq('is_analyzed', false);
    }

    if (filterTime === "24h") {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      query = query.gte('posted_at', yesterday.toISOString());
    }

    if (minFans) {
      query = query.gte('author_fans', parseInt(minFans));
    }

    if (minCollect) {
      query = query.gte('collect_count', parseInt(minCollect));
    }

    const { data: rawData, error } = await query
      .order('views_count', { ascending: false }) 
      .limit(100);
      
    if (error) {
      toast.error("Lỗi tải dữ liệu thô");
    } else {
      setData(rawData || []);
      setSelectedIds(new Set()); 
    }
    setLoading(false);
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
    if (selectedIds.size === data.length && data.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(item => item.id)));
    }
  };


  const handleSyncCategories = async () => {
    setLoading(true);
    toast.info("Đang đồng bộ lại danh mục từ Nguồn cào...");
    try {
      const { data: sources } = await supabase.from('crawl_sources').select('id, category_id');
      if (sources) {
        for (const source of sources) {
          if (source.category_id) {
            await supabase
              .from('crawled_data')
              .update({ category_id: source.category_id })
              .eq('source_id', source.id)
              .is('category_id', null);
          }
        }
      }
      toast.success("Đồng bộ danh mục hoàn tất!");
      fetchData();
    } catch (e) {
      toast.error("Lỗi khi đồng bộ");
    } finally {
      setLoading(false);
    }
  };

  const openAnalyzeModal = () => {
    setIsAnalyzeModalOpen(true);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStatusText("Đang khởi tạo...");
    
    try {
      // 1. Determine IDs to analyze
      let targetIds = Array.from(selectedIds);
      if (targetIds.length === 0) {
        setAnalyzeStatusText("Đang lấy danh sách bài viết...");
        // Fetch unanalyzed items based on category
        let query = supabase.from('crawled_data').select('id').eq('is_analyzed', false);
        if (selectedCategoryId && selectedCategoryId !== 'all') {
            query = query.eq('category_id', selectedCategoryId);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            toast.info("Không có bài viết nào cần phân tích.");
            setIsAnalyzing(false);
            return;
        }
        targetIds = data.map(d => d.id as string);
      }

      // 2. Start Session
      setAnalyzeStatusText("Đang tạo phiên phân tích...");
      const sessionRes = await fetch('/api/ai/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: selectedCategoryId || 'all', total_items: targetIds.length })
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.error || "Không thể tạo phiên");
      const logId = sessionData.log_id;

      // 3. Batch Processing
      const BATCH_SIZE = 15;
      let accumulatedTokens = 0;
      let totalFound = 0;
      
      for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batchIds = targetIds.slice(i, i + BATCH_SIZE);
        const isFinal = (i + BATCH_SIZE) >= targetIds.length;
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(targetIds.length / BATCH_SIZE);
        
        setAnalyzeStatusText(`Đang xử lý lô ${currentBatch}/${totalBatches}...`);
        setAnalyzeProgress(Math.round((i / targetIds.length) * 100));

        const batchRes = await fetch('/api/ai/analyze-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                item_ids: batchIds,
                category_id: selectedCategoryId || 'all',
                log_id: logId,
                is_final_batch: isFinal,
                accumulated_tokens: accumulatedTokens
            })
        });
        
        const batchData = await batchRes.json();
        if (!batchRes.ok) throw new Error(batchData.error || `Lỗi ở lô ${currentBatch}`);
        
        accumulatedTokens += (batchData.tokens_used || 0);
        totalFound += (batchData.trends_found || 0);
      }

      setAnalyzeProgress(100);
      setAnalyzeStatusText(`Hoàn tất! Tìm thấy ${totalFound} trends mới.`);
      toast.success("Phân tích hoàn tất!");
      
      setTimeout(() => {
          setIsAnalyzeModalOpen(false);
          setSelectedIds(new Set());
          fetchData(); // Refresh table
      }, 2000);

    } catch (error: any) {
      setAnalyzeStatusText("Lỗi: " + error.message);
      toast.error("Lỗi phân tích: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} bài đăng đã chọn?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('crawled_data')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`Đã xóa ${selectedIds.size} mục thành công`);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      toast.error("Lỗi khi xóa dữ liệu: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài đăng này?")) return;

    try {
      const { error } = await supabase
        .from('crawled_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Đã xóa mục thành công");
      fetchData();
    } catch (e: any) {
      toast.error("Lỗi khi xóa: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Dữ liệu thô (Crawl)</h2>
          <p className="text-sm text-gray-500">Quản lý và lọc dữ liệu TikTok trước khi đưa vào phân tích AI</p>
        </div>
        <div className="flex gap-3">
            {selectedIds.size > 0 && (
                <Button onClick={handleDeleteBulk} variant="outline" className="h-10 border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa ({selectedIds.size})
                </Button>
            )}
            <Button onClick={handleSyncCategories} variant="outline" className="h-10 border-gray-200 text-gray-600 hover:bg-gray-50">
               Cập nhật Niche
            </Button>
            <Button onClick={openAnalyzeModal} disabled={isAnalyzing} variant="default" className="h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-200">
               <BrainCircuit className="w-4 h-4 mr-2" />
               Chạy Agent Phân Tích {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter className="w-4 h-4 text-blue-600" />
                Bộ lọc nâng cao
            </div>
            <Button onClick={fetchData} variant="ghost" size="sm" className="h-8 text-gray-500">
              Làm mới dữ liệu
            </Button>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Chủ đề Niche</Label>
              <Select value={filterCategory} onValueChange={(val) => val && setFilterCategory(val)}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100">
                  <SelectValue placeholder="Tất cả Niche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Niche</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Trạng thái</Label>
              <Select value={filterStatus} onValueChange={(val) => val && setFilterStatus(val)}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="unanalyzed">Chưa phân tích</SelectItem>
                  <SelectItem value="analyzed">Đã phân tích</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Thời gian</Label>
              <Select value={filterTime} onValueChange={(val) => val && setFilterTime(val)}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100">
                  <SelectValue placeholder="Tất cả thời gian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả thời gian</SelectItem>
                  <SelectItem value="24h">Trong 24h qua</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Fans tối thiểu</Label>
              <Input type="number" placeholder="1,000+" className="bg-gray-50/50 border-gray-100" value={minFans} onChange={(e) => setMinFans(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Lượt Lưu tối thiểu</Label>
              <Input type="number" placeholder="50+" className="bg-gray-50/50 border-gray-100" value={minCollect} onChange={(e) => setMinCollect(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-12 text-center px-4">
                  <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={data.length > 0 && selectedIds.size === data.length} onChange={toggleAll} />
                </TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>Tác giả</TableHead>
                <TableHead className="w-1/4">Nội dung</TableHead>
                <TableHead className="text-right">Metrics (View ↓)</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={8} className="text-center py-10">Đang tải dữ liệu...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-500">Không tìm thấy bài đăng nào.</TableCell></TableRow>
              ) : data.map((item) => (
                <TableRow key={item.id} className={cn(selectedIds.has(item.id) && "bg-purple-50/50", "hover:bg-gray-50/50 transition-colors cursor-pointer")} onClick={() => setSelectedItem(item)}>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} />
                  </TableCell>
                  <TableCell>
                    {item.is_analyzed ? (
                       <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Đã phân tích</Badge>
                    ) : (
                       <Badge variant="secondary" className="text-gray-400 font-normal">Chưa xử lý</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.categories ? (
                      <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded">{item.categories.name}</span>
                    ) : <span className="text-xs text-gray-400">-</span>}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{item.author_name}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{item.author_fans?.toLocaleString()} fans {item.author_verified && '✅'}</div>
                  </TableCell>
                  <TableCell>
                     <p className="line-clamp-2 text-sm text-gray-600 mb-1">{item.text_content}</p>
                     <div className="flex flex-wrap gap-1">
                        {item.music_name && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">🎵 {item.music_name}</span>}
                        {item.is_slideshow && <span className="text-[10px] bg-orange-50 text-orange-600 px-1 rounded">🖼 Album</span>}
                     </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <div className="font-bold">👁 {item.views_count?.toLocaleString()}</div>
                    <div className="text-gray-500 text-[10px]">❤️ {item.likes_count?.toLocaleString()} | 💾 {item.collect_count?.toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 font-medium">
                    <div className="flex flex-col">
                      <span className="text-gray-800">{formatRelativeTime(item.posted_at)}</span>
                      <span className="text-[9px] text-gray-400">{item.posted_at ? new Date(item.posted_at).toLocaleDateString('vi-VN') : '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a href={item.post_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full">
                          <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSingle(item.id)} className="text-gray-400 hover:text-red-500 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Modal */}
      <Dialog open={isAnalyzeModalOpen} onOpenChange={setIsAnalyzeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chạy Agent Phân Tích {selectedIds.size > 0 ? `(${selectedIds.size} bài đã chọn)` : '(Lọc bài mới)'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chọn Nhóm Niche (Áp dụng Prompt riêng)</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                <option value="all">-- Phân tích tất cả Niche --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full bg-purple-600">{isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu chạy AI'}</Button>
            
            {isAnalyzing && (
              <div className="space-y-2 mt-4 bg-gray-50 p-4 rounded-lg border">
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{analyzeStatusText}</span>
                  <span>{analyzeProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${analyzeProgress}%` }}></div>
                </div>
                <p className="text-xs text-red-500 italic mt-1">⚠️ Vui lòng KHÔNG đóng trình duyệt trong lúc tiến trình đang chạy.</p>
              </div>
            )}
            
            {analyzeProgress === 100 && !isAnalyzing && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm text-center">
                {analyzeStatusText}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal - Premium UI (FIXED) */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl bg-white overflow-x-hidden">
          <div className="relative w-full">
            {/* Header Background */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 h-24 md:h-32 w-full" />
            
            <div className="px-4 md:px-8 pb-8 -mt-10 md:-mt-12">
              <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-100 p-5 md:p-8">
                {selectedItem && (
                  <div className="space-y-6 md:space-y-10">
                    {/* Top Info */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 md:pb-8 border-b border-gray-50">
                      <div className="flex gap-4 md:gap-6">
                        <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-2xl md:text-3xl shadow-inner border border-blue-100">
                          {selectedItem.author_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                             <h3 className="font-black text-gray-900 text-xl md:text-3xl tracking-tight break-words">{selectedItem.author_name}</h3>
                             {selectedItem.author_verified && <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-50 shrink-0" />}
                          </div>
                          <p className="text-gray-500 font-bold text-sm md:text-lg break-all">@{selectedItem.author_username}</p>
                          <div className="flex items-center gap-2 md:gap-4 mt-2 flex-wrap">
                              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] md:text-sm font-bold border border-blue-100 shrink-0">
                                 <Users className="size-3 md:size-4" /> {selectedItem.author_fans?.toLocaleString()} Fans
                              </div>
                              <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2 py-1 rounded-full text-[10px] md:text-sm font-bold border border-purple-100 shrink-0">
                                 <Hash className="size-3 md:size-4" /> {selectedItem.categories?.name || 'Chưa phân loại'}
                              </div>
                              <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-2 py-1 rounded-full text-[10px] md:text-sm font-bold border border-orange-100 shrink-0">
                                 <Clock className="size-3 md:size-4" /> Đăng {formatRelativeTime(selectedItem.posted_at)}
                              </div>
                          </div>
                        </div>
                      </div>
                      <a 
                        href={selectedItem.post_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className={cn(buttonVariants({ variant: "default" }), "w-full md:w-auto bg-black hover:bg-gray-800 text-white rounded-xl md:rounded-2xl h-12 md:h-14 px-6 md:px-8 text-sm md:text-lg font-bold shadow-lg shadow-gray-200 transition-all shrink-0")}
                      >
                        <ExternalLink className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3" /> Xem trên TikTok
                      </a>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
                      {/* Left: Content */}
                      <div className="lg:col-span-2 space-y-6 md:space-y-8 min-w-0">
                        <div className="space-y-3 md:space-y-4">
                          <h4 className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-black text-gray-400">Nội dung bài đăng</h4>
                          <div className="bg-gray-50/50 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 text-gray-700 leading-relaxed text-sm md:text-lg font-medium shadow-inner italic break-words">
                            "{selectedItem.text_content || "(Không có nội dung chữ)"}"
                          </div>
                        </div>

                        {selectedItem.transcript && (
                          <div className="space-y-3 md:space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                             <div className="flex items-center gap-2">
                                <h4 className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-black text-blue-500">Kịch bản video (Script AI)</h4>
                                <Badge variant="outline" className="text-[8px] border-blue-200 text-blue-600 bg-blue-50">Tự động bóc tách</Badge>
                             </div>
                             <div className="bg-blue-50/30 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-blue-100/50 text-gray-800 leading-relaxed text-sm md:text-base font-normal shadow-sm">
                                {selectedItem.transcript}
                             </div>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 md:gap-5">
                           <div className="p-3 md:p-5 bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden">
                              <Music className="size-4 md:size-6 mb-2 md:mb-3 text-blue-500 shrink-0" />
                              <div className="text-[8px] md:text-[10px] text-gray-400 uppercase font-black mb-1">Âm nhạc</div>
                              <div className="text-[10px] md:text-xs font-black text-gray-800 break-words line-clamp-2 w-full px-1" title={selectedItem.music_name}>
                                {selectedItem.music_name || 'Mặc định'}
                              </div>
                           </div>
                           <div className="p-3 md:p-5 bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                              <Clock className="size-4 md:size-6 mb-2 md:mb-3 text-orange-500 shrink-0" />
                              <div className="text-[8px] md:text-[10px] text-gray-400 uppercase font-black mb-1">Thời lượng</div>
                              <div className="text-[10px] md:text-sm font-black text-gray-800">{selectedItem.video_duration}s</div>
                           </div>
                           <div className="p-3 md:p-5 bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                              <Play className="size-4 md:size-6 mb-2 md:mb-3 text-green-500 shrink-0" />
                              <div className="text-[8px] md:text-[10px] text-gray-400 uppercase font-black mb-1">Định dạng</div>
                              <div className="text-[10px] md:text-sm font-black text-gray-800">{selectedItem.is_slideshow ? 'Album' : 'Video'}</div>
                           </div>
                        </div>
                      </div>

                      {/* Right: Stats */}
                      <div className="space-y-6 md:space-y-8 min-w-0">
                         <h4 className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-black text-gray-400">Chỉ số lan truyền</h4>
                         <div className="space-y-4 md:space-y-5">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl md:rounded-3xl p-5 md:p-7 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                                <div className="text-[10px] md:text-xs font-black text-blue-100 uppercase mb-1 md:mb-2 tracking-widest">Lượt Xem</div>
                                <div className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black tabular-nums tracking-tighter break-all">
                                    {selectedItem.views_count?.toLocaleString()}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:gap-4">
                                <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4 md:p-6 overflow-hidden">
                                    <div className="text-[8px] md:text-[10px] text-pink-400 font-black uppercase mb-1 tracking-widest">Lượt Tim</div>
                                    <div className="text-lg md:text-2xl lg:text-3xl font-black text-pink-600 tabular-nums tracking-tighter break-all">
                                        {selectedItem.likes_count?.toLocaleString()}
                                    </div>
                                </div>
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 md:p-6 overflow-hidden">
                                    <div className="text-[8px] md:text-[10px] text-orange-400 font-black uppercase mb-1 tracking-widest">Lượt Lưu</div>
                                    <div className="text-lg md:text-2xl lg:text-3xl font-black text-orange-600 tabular-nums tracking-tighter break-all">
                                        {selectedItem.collect_count?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                         </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 md:gap-6 pt-6 md:pt-10 border-t border-gray-50 text-gray-400">
                       <div className="text-[8px] md:text-[10px] font-mono truncate w-full sm:w-auto">ID: {selectedItem.id}</div>
                       <div className="flex items-center gap-4 md:gap-8 w-full sm:w-auto justify-between sm:justify-end">
                           <div className="text-[10px] md:text-sm flex items-center gap-2 font-medium shrink-0">
                               <Clock className="size-3 md:size-4" /> {new Date(selectedItem.created_at).toLocaleString('vi-VN')}
                           </div>
                           <Button variant="outline" onClick={() => setSelectedItem(null)} className="rounded-xl h-10 md:h-12 px-6 md:px-10 border-gray-200 font-bold">Đóng</Button>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
