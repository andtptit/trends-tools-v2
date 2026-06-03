"use client";

import { useEffect, useState, useMemo } from "react";
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

const VIETNAMESE_STOP_WORDS = new Set([
  "thì", "mà", "là", "và", "của", "để", "cho", "trong", "ngoài", "đã", "đang", "sẽ", "được", "bị", "bởi", "tại", "ở",
  "có", "không", "nhưng", "như", "này", "đó", "kia", "ấy", "nào", "gì", "sao", "các", "những", "một", "hai", "ba",
  "cái", "chiếc", "con", "người", "họ", "chúng", "tôi", "anh", "chị", "em", "nó", "chúng ta", "chúng tôi", "bạn",
  "ra", "vào", "lên", "xuống", "đến", "đi", "lại", "qua", "về", "với", "từ", "đầu", "cuối", "trước", "sau", "khi",
  "lúc", "giờ", "ngày", "tháng", "năm", "nay", "hôm", "nhiều", "ít", "quá", "rất", "hơn", "nhất", "chỉ", "cũng",
  "cả", "đều", "hết", "còn", "nữa", "vẫn", "làm", "tự", "thể", "biết", "thấy", "nghĩ", "muốn", "cần",
  "phải", "nên", "hãy", "vừa", "mới", "xong", "rồi", "nhận", "mang", "đem", "giúp", "bằng", "theo", "nhau",
  "cùng", "khác", "mọi", "mỗi", "từng", "toàn", "bộ", "video", "bài", "viết", "cho", "cách", "làm"
]);

function analyzeFrequency(items: any[]) {
  const unigramCounts: { [key: string]: number } = {};
  const bigramCounts: { [key: string]: number } = {};
  const musicCounts: { [key: string]: number } = {};

  items.forEach(item => {
    // 1. Music
    const music = (item.music_name || "").trim();
    const musicLower = music.toLowerCase();
    if (music && musicLower !== "âm thanh gốc" && musicLower !== "original sound") {
      musicCounts[music] = (musicCounts[music] || 0) + 1;
    }

    // 2. Text
    const text = ((item.text_content || "") + " " + (item.transcript || ""))
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = text.split(" ").map(w => w.trim()).filter(w => w.length > 1);

    for (let i = 0; i < words.length; i++) {
      const w1 = words[i];
      const w1Lower = w1.toLowerCase();

      if (!VIETNAMESE_STOP_WORDS.has(w1Lower)) {
        const key = w1[0] === w1[0].toUpperCase() ? w1 : w1Lower;
        unigramCounts[key] = (unigramCounts[key] || 0) + 1;
      }

      if (i < words.length - 1) {
        const w2 = words[i + 1];
        const w2Lower = w2.toLowerCase();
        
        if (!VIETNAMESE_STOP_WORDS.has(w1Lower) && !VIETNAMESE_STOP_WORDS.has(w2Lower)) {
          const isW1Cap = w1[0] === w1[0].toUpperCase();
          const isW2Cap = w2[0] === w2[0].toUpperCase();
          const p1 = isW1Cap ? w1 : w1Lower;
          const p2 = isW2Cap ? w2 : w2Lower;
          const bigram = `${p1} ${p2}`;
          bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
        }
      }
    }
  });

  const topUnigrams = Object.entries(unigramCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const topBigrams = Object.entries(bigramCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const topMusic = Object.entries(musicCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return { topUnigrams, topBigrams, topMusic };
}

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
  const [onlyQualified, setOnlyQualified] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
  const [useFilteredForFrequency, setUseFilteredForFrequency] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

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
    setSelectedKeyword(null);
    setSelectedMusic(null);
    setUseFilteredForFrequency(false);
    setCurrentPage(1);
  }, [filterCategory, filterStatus, filterTime, minFans, minCollect, onlyQualified]);

  // Reset page when tags change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedKeyword, selectedMusic]);

  const displayedData = useMemo(() => {
    let result = data;
    if (selectedKeyword) {
      const kw = selectedKeyword.toLowerCase();
      result = result.filter(item => 
        (item.text_content || "").toLowerCase().includes(kw) || 
        (item.transcript || "").toLowerCase().includes(kw)
      );
    }
    if (selectedMusic) {
      const mus = selectedMusic.toLowerCase();
      result = result.filter(item => 
        (item.music_name || "").toLowerCase() === mus
      );
    }
    return result;
  }, [data, selectedKeyword, selectedMusic]);

  const frequencies = useMemo(() => {
    return analyzeFrequency(useFilteredForFrequency ? displayedData : data);
  }, [data, displayedData, useFilteredForFrequency]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [displayedData, currentPage]);

  const totalPages = Math.ceil(displayedData.length / ITEMS_PER_PAGE);

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

    const limitCount = onlyQualified ? 300 : 100;

    const { data: rawData, error } = await query
      .order('views_count', { ascending: false }) 
      .limit(limitCount);
      
    if (error) {
      toast.error("Lỗi tải dữ liệu thô");
    } else {
      let filteredData = rawData || [];

      if (onlyQualified && filterCategory !== "all") {
        const selectedCat = categories.find(c => c.id === filterCategory);
        if (selectedCat) {
          const reqMinViews = selectedCat.min_views || 0;

          // Filter by min_views
          filteredData = filteredData.filter(item => (item.views_count || 0) >= reqMinViews);
        }
      }

      setData(filteredData);
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
    if (selectedIds.size === displayedData.length && displayedData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedData.map(item => item.id)));
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

      // 3. Gửi Webhook cho n8n
      setAnalyzeStatusText("Đang gửi lệnh cho n8n...");
      const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
      if (!webhookUrl || webhookUrl.includes('your-n8n-url')) {
          throw new Error("Chưa cấu hình NEXT_PUBLIC_N8N_WEBHOOK_URL hợp lệ");
      }

      const webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              item_ids: targetIds,
              category_id: selectedCategoryId || 'all',
              log_id: logId
          })
      });
      
      if (!webhookRes.ok) throw new Error("n8n Webhook không phản hồi hoặc báo lỗi");


      setAnalyzeProgress(100);
      setAnalyzeStatusText(`Đã gửi lệnh cho n8n thành công!`);
      toast.success("Tiến trình đang chạy ngầm qua n8n. Xem tiến độ tại tab Nhật ký AI.");
      
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
              <select 
                className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">Tất cả Niche</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Trạng thái</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="unanalyzed">Chưa phân tích</option>
                <option value="analyzed">Đã phân tích</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Thời gian</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                value={filterTime} 
                onChange={(e) => setFilterTime(e.target.value)}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="24h">Trong 24h qua</option>
              </select>
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
          {filterCategory !== "all" && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="onlyQualified"
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                  checked={onlyQualified}
                  onChange={(e) => setOnlyQualified(e.target.checked)}
                />
                <label htmlFor="onlyQualified" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  Chỉ hiển thị bài đủ điều kiện phân tích của Niche
                </label>
              </div>
              {(() => {
                const activeCat = categories.find(c => c.id === filterCategory);
                if (!activeCat) return null;
                return (
                  <div className="bg-purple-50/50 px-4 py-3 rounded-lg border border-purple-100 text-xs text-purple-800 flex flex-wrap gap-x-6 gap-y-1.5 items-center font-medium">
                    <span className="flex items-center gap-1 font-bold text-[13px] text-purple-900 border-r border-purple-200 pr-4 mr-2">
                      📌 Cài đặt Niche hiện tại:
                    </span>
                    <span>Lượt xem tối thiểu: <b className="text-purple-950 font-extrabold">{(activeCat.min_views || 0).toLocaleString()} views</b></span>
                    <span>Số video trùng lặp tối thiểu: <b className="text-purple-950 font-extrabold">{activeCat.min_videos || 1} video</b></span>
                    <span>Số kênh trùng lặp tối thiểu: <b className="text-purple-950 font-extrabold">{activeCat.min_channels || 1} kênh</b></span>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Realtime Frequency Widget */}
      {data.length > 0 && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="bg-purple-50/30 px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-900">
              <Layers className="w-4 h-4 text-purple-600" />
              Phân tích cụm từ & âm nhạc nổi bật (Thời gian thực trên {data.length} bài đã tải)
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setUseFilteredForFrequency(prev => !prev)}
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50",
                  useFilteredForFrequency && "bg-purple-100 border-purple-300 font-bold"
                )}
                title="Tính toán lại cụm từ dựa trên danh sách đang hiển thị sau khi lọc"
              >
                🔄 {useFilteredForFrequency ? "Tính theo toàn bộ" : "Tính theo bộ lọc"}
              </Button>
              {(selectedKeyword || selectedMusic) && (
                <>
                  <Button 
                    onClick={() => {
                      setSelectedIds(new Set(displayedData.map(item => item.id)));
                      setSelectedCategoryId(filterCategory);
                      setIsAnalyzeModalOpen(true);
                    }}
                    variant="default" 
                    size="sm" 
                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Phân tích nhóm đã lọc ({displayedData.length} bài)
                  </Button>
                  <Button 
                    onClick={() => {
                      setSelectedKeyword(null);
                      setSelectedMusic(null);
                    }} 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Xóa bộ lọc tag
                  </Button>
                </>
              )}
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            {/* Music frequencies */}
            {frequencies.topMusic.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">🎵 Âm nhạc trùng lặp nhiều nhất</Label>
                <div className="flex flex-wrap gap-2">
                  {frequencies.topMusic.map(item => (
                    <Badge 
                      key={item.word}
                      onClick={() => {
                        setSelectedMusic(selectedMusic === item.word ? null : item.word);
                        setSelectedKeyword(null);
                      }}
                      className={cn(
                        "cursor-pointer px-2.5 py-1 text-xs border transition-all font-semibold rounded-full",
                        selectedMusic === item.word 
                          ? "bg-purple-600 text-white border-purple-600" 
                          : "bg-blue-50/50 hover:bg-blue-50 text-blue-700 border-blue-100"
                      )}
                    >
                      {item.word} ({item.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bigram frequencies */}
              {frequencies.topBigrams.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">🏷️ Cụm từ nóng (2 từ)</Label>
                  <div className="flex flex-wrap gap-2">
                    {frequencies.topBigrams.map(item => (
                      <Badge 
                        key={item.word}
                        onClick={() => {
                          setSelectedKeyword(selectedKeyword === item.word ? null : item.word);
                          setSelectedMusic(null);
                        }}
                        className={cn(
                          "cursor-pointer px-2.5 py-1 text-xs border transition-all rounded-md font-medium",
                          selectedKeyword === item.word 
                            ? "bg-purple-600 text-white border-purple-600" 
                            : "bg-green-50/50 hover:bg-green-50 text-green-700 border-green-100"
                        )}
                      >
                        {item.word} ({item.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Unigram frequencies */}
              {frequencies.topUnigrams.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">🏷️ Từ khóa đơn nổi bật</Label>
                  <div className="flex flex-wrap gap-2">
                    {frequencies.topUnigrams.map(item => (
                      <Badge 
                        key={item.word}
                        onClick={() => {
                          setSelectedKeyword(selectedKeyword === item.word ? null : item.word);
                          setSelectedMusic(null);
                        }}
                        className={cn(
                          "cursor-pointer px-2.5 py-1 text-xs border transition-all rounded-md font-medium",
                          selectedKeyword === item.word 
                            ? "bg-purple-600 text-white border-purple-600" 
                            : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                        )}
                      >
                        {item.word} ({item.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full table-fixed min-w-[1000px] lg:min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-12 text-center px-4">
                  <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={displayedData.length > 0 && selectedIds.size === displayedData.length} onChange={toggleAll} />
                </TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
                <TableHead className="w-28">Niche</TableHead>
                <TableHead className="w-44">Tác giả</TableHead>
                <TableHead className="w-auto">Nội dung</TableHead>
                <TableHead className="w-44 text-right">Metrics (View ↓)</TableHead>
                <TableHead className="w-32">Thời gian</TableHead>
                <TableHead className="w-24 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={8} className="text-center py-10">Đang tải dữ liệu...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-500">Không tìm thấy bài đăng nào.</TableCell></TableRow>
              ) : paginatedData.map((item) => (
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
                  <TableCell className="font-medium max-w-[176px]">
                    <div className="truncate w-full font-bold" title={item.author_name}>{item.author_name}</div>
                    <div className="text-[10px] text-gray-400 font-normal truncate w-full">{item.author_fans?.toLocaleString()} fans {item.author_verified && '✅'}</div>
                  </TableCell>
                  <TableCell>
                     <p className="line-clamp-2 text-sm text-gray-600 mb-1">{item.text_content}</p>
                     <div className="flex flex-wrap gap-1">
                        {item.music_name && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded truncate max-w-[150px]" title={item.music_name}>🎵 {item.music_name}</span>}
                        {item.is_slideshow && <span className="text-[10px] bg-orange-50 text-orange-600 px-1 rounded shrink-0">🖼 Album</span>}
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
                  <TableCell onClick={(e) => e.stopPropagation()} className="px-2">
                    <div className="flex items-center justify-center gap-1">
                      <a href={item.post_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full shrink-0">
                          <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSingle(item.id)} className="text-gray-400 hover:text-red-500 h-8 w-8 shrink-0">
                          <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="bg-gray-50/50 px-6 py-4 border-t flex items-center justify-between text-sm text-gray-600">
            <div>
              Hiển thị <b>{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, displayedData.length)}</b> đến <b>{Math.min(currentPage * ITEMS_PER_PAGE, displayedData.length)}</b> trong tổng số <b>{displayedData.length}</b> bài đăng
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 font-medium border-gray-200"
              >
                Trước
              </Button>
              <div className="flex items-center px-3 font-semibold text-gray-700 bg-white border border-gray-200 rounded-md h-8 text-xs">
                Trang {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 font-medium border-gray-200"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
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
