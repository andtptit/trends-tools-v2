"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrainCircuit, ExternalLink, Filter, Users, Bookmark, Clock, Hash, Music, Play, Layers, Trash2 } from "lucide-react";
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

  // AI Analyze Modal states
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
    
    // Áp dụng bộ lọc Niche
    if (filterCategory !== "all") {
      query = query.eq('category_id', filterCategory);
    }

    // Áp dụng bộ lọc Trạng thái
    if (filterStatus === "analyzed") {
      query = query.eq('is_analyzed', true);
    } else if (filterStatus === "unanalyzed") {
      query = query.eq('is_analyzed', false);
    }

    // Áp dụng bộ lọc Thời gian
    if (filterTime === "24h") {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      query = query.gte('posted_at', yesterday.toISOString());
    }

    // Áp dụng bộ lọc Fans tối thiểu
    if (minFans) {
      query = query.gte('author_fans', parseInt(minFans));
    }

    // Áp dụng bộ lọc Lượt lưu tối thiểu
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
      setSelectedIds(new Set()); // Reset selection when filters change
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

  const openAnalyzeModal = () => {
    if (selectedIds.size === 0) {
      toast.warning("Vui lòng chọn ít nhất 1 bài để phân tích!");
      return;
    }
    setIsAnalyzeModalOpen(true);
  };

  const handleSyncCategories = async () => {
    setLoading(true);
    toast.info("Đang đồng bộ lại danh mục từ Nguồn cào...");
    try {
      // Gọi một hàm RPC hoặc xử lý logic đồng bộ
      // Ở đây ta làm đơn giản: Lấy tất cả bài chưa có category_id và map lại
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

  const handleAnalyze = async () => {
    if (!selectedCategoryId) {
      toast.error("Vui lòng chọn Nhóm Niche để áp dụng Prompt!");
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item_ids: Array.from(selectedIds),
          category_id: selectedCategoryId
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        toast.success(result.message || "Phân tích thành công!");
        setIsAnalyzeModalOpen(false);
        setSelectedIds(new Set());
        fetchData(); 
      } else {
        toast.error(result.error || "Có lỗi khi phân tích");
      }
    } catch (e) {
      toast.error("Lỗi kết nối API AI");
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
                <Button onClick={handleDeleteBulk} variant="outline" className="h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa ({selectedIds.size})
                </Button>
            )}
            <Button onClick={handleSyncCategories} variant="outline" className="h-10 border-gray-200 text-gray-600 hover:bg-gray-50">
               Cập nhật Niche
            </Button>
            <Button onClick={openAnalyzeModal} variant="default" className="h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-200">
               <BrainCircuit className="w-4 h-4 mr-2" />
               Bắt đầu phân tích ({selectedIds.size})
            </Button>
        </div>
      </div>

      {/* BỘ LỌC PREMIUM */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter className="w-4 h-4 text-blue-600" />
                Bộ lọc nâng cao
            </div>
            <Button onClick={fetchData} variant="ghost" size="sm" className="h-8 text-gray-500 hover:text-blue-600">
              Làm mới dữ liệu
            </Button>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Chủ đề Niche</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100 focus:ring-blue-500">
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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100 focus:ring-blue-500">
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
              <Select value={filterTime} onValueChange={setFilterTime}>
                <SelectTrigger className="bg-gray-50/50 border-gray-100 focus:ring-blue-500">
                  <SelectValue placeholder="Tất cả thời gian" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả thời gian</SelectItem>
                  <SelectItem value="24h">Trong 24h qua</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> Fans tối thiểu
              </Label>
              <div className="relative">
                <Input 
                    type="number" 
                    placeholder="1,000+"
                    className="bg-gray-50/50 border-gray-100 focus:ring-blue-500 pl-3"
                    value={minFans}
                    onChange={(e) => setMinFans(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1">
                <Bookmark className="w-3 h-3" /> Lượt Lưu tối thiểu
              </Label>
              <Input 
                type="number" 
                placeholder="50+"
                className="bg-gray-50/50 border-gray-100 focus:ring-blue-500 pl-3"
                value={minCollect}
                onChange={(e) => setMinCollect(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-none border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="w-12 text-center px-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer"
                      checked={data.length > 0 && selectedIds.size === data.length}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Tác giả</TableHead>
                  <TableHead className="w-1/4">Nội dung / Nhạc / Định dạng</TableHead>
                  <TableHead className="text-right">TikTok Metrics (View ↓)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow><TableCell colSpan={7} className="text-center py-10">Đang tải dữ liệu...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-500">Không tìm thấy bài đăng nào phù hợp với bộ lọc.</TableCell></TableRow>
                ) : data.map((item) => (
                  <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-purple-50/50" : "hover:bg-gray-50/50 transition-colors"}>
                    <TableCell className="text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
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
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{item.author_name}</div>
                      <div className="text-[10px] text-gray-400 font-normal">
                        {item.author_fans?.toLocaleString()} fans {item.author_verified && '✅'}
                      </div>
                    </TableCell>
                    <TableCell>
                       <p className="line-clamp-2 text-sm text-gray-600 mb-1">{item.text_content}</p>
                       <div className="flex flex-wrap gap-1">
                          {item.music_name && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded flex items-center">🎵 {item.music_name}</span>}
                          {item.is_slideshow && <span className="text-[10px] bg-orange-50 text-orange-600 px-1 rounded">🖼 Album</span>}
                          {item.video_duration > 0 && <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">⏱ {item.video_duration}s</span>}
                       </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <div className="font-bold whitespace-nowrap">👁 {item.views_count?.toLocaleString()}</div>
                      <div className="text-gray-500 text-xs flex flex-col items-end">
                         <span>❤️ {item.likes_count?.toLocaleString()}</span>
                         <span className="text-blue-500">💾 {item.collect_count?.toLocaleString()} lưu</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a href={item.post_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full transition-colors">
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
          </div>
        </CardContent>
      </Card>

      {/* Modal Phân tích AI */}
      <Dialog open={isAnalyzeModalOpen} onOpenChange={setIsAnalyzeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi {selectedIds.size} bài cho AI phân tích</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Chọn Nhóm Niche (Để AI dùng đúng Prompt chuyên gia)</Label>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedCategoryId} 
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="" disabled>-- Chọn Niche --</option>
                {categories.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => setIsAnalyzeModalOpen(false)}>Hủy</Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-700">
              {isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu phân tích'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
