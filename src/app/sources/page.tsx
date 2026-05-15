"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Edit2, Trash2, Play, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("tiktok_profile");
  const [newUrl, setNewUrl] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const [categories, setCategories] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchSources();
    fetchCategories();

    // Thiết lập Realtime subscription
    const channel = supabase
      .channel('crawl_sources_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crawl_sources',
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          const updatedSource = payload.new as any;
          if (!updatedSource || !updatedSource.id) return;

          setSources((prev) => 
            prev.map((s) => s.id === updatedSource.id ? { ...s, ...updatedSource } : s)
          );

          // Thông báo khi hoàn thành hoặc lỗi
          if (updatedSource.last_crawl_status === 'completed') {
            toast.success(`Nguồn "${updatedSource.name}" đã cào xong dữ liệu!`, {
                icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
                duration: 5000
            });
          } else if (updatedSource.last_crawl_status === 'error') {
            toast.error(`Nguồn "${updatedSource.name}" gặp lỗi khi cào.`);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crawl_sources')
      .select('*, categories(name)')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Lỗi tải danh sách nguồn");
    } else {
      setSources(data || []);
    }
    setLoading(false);
  };

  const triggerCrawl = async (id: string) => {
    toast.info("Đang gửi lệnh cào cho Apify...");
    try {
      const res = await fetch('/api/crawl/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: id })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Đã gửi lệnh thành công");
      } else {
        toast.error(data.error || "Có lỗi xảy ra khi trigger");
      }
    } catch (e) {
      toast.error("Lỗi kết nối API");
    }
  };

  const resetStatus = async (id: string) => {
    // 5. Cập nhật trạng thái nguồn đã hoàn thành
    const { error } = await supabase
        .from('crawl_sources')
        .update({ last_crawl_status: 'idle' })
        .eq('id', id);
    
    if (error) {
        toast.error("Không thể reset trạng thái");
    } else {
        setSources(prev => prev.map(s => s.id === id ? { ...s, last_crawl_status: 'idle' } : s));
        toast.success("Đã reset trạng thái nguồn");
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setNewName("");
    setNewType("tiktok_profile");
    setNewUrl("");
    setNewCategoryId("");
    setIsModalOpen(true);
  }

  const openEditModal = (source: any) => {
    setEditingId(source.id);
    setNewName(source.name);
    setNewType(source.type);
    setNewUrl(source.url);
    setNewCategoryId(source.category_id || "");
    setIsModalOpen(true);
  }

  const handleDeleteSource = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá nguồn này không? (Hành động này không thể hoàn tác)")) return;
    
    const { error } = await supabase
      .from('crawl_sources')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Lỗi khi xoá: " + error.message);
    } else {
      toast.success("Đã xoá nguồn cào thành công");
      fetchSources();
    }
  }

  const handleSaveSource = async () => {
    if (!newName || !newUrl) {
      toast.error("Vui lòng điền đầy đủ tên và đường dẫn/ID");
      return;
    }

    setIsSubmitting(true);
    
    const payload = {
      name: newName, 
      type: newType, 
      url: newUrl,
      category_id: newCategoryId || null
    };

    let error;
    if (editingId) {
       const { error: updateError } = await supabase
        .from('crawl_sources')
        .update(payload)
        .eq('id', editingId);
       error = updateError;
    } else {
       const { error: insertError } = await supabase
        .from('crawl_sources')
        .insert([payload]);
       error = insertError;
    }

    setIsSubmitting(false);

    if (error) {
      toast.error("Lỗi khi lưu nguồn: " + error.message);
    } else {
      toast.success(editingId ? "Đã cập nhật nguồn thành công" : "Đã thêm nguồn thành công");
      setIsModalOpen(false);
      fetchSources();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Quản lý Nguồn Dữ Liệu</h2>
        <Button onClick={openAddModal} variant="default">Thêm Nguồn Mới</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách kênh / hashtag cần cào</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Niche</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>URL / ID</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">Chưa có nguồn nào.</TableCell></TableRow>
              ) : sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                     {source.categories ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">{source.categories.name}</Badge>
                     ) : (
                        <span className="text-xs text-gray-400">Chưa phân loại</span>
                     )}
                  </TableCell>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{source.type}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{source.url}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                        <Badge variant={source.is_active ? "default" : "secondary"}>
                        {source.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                        </Badge>
                        {source.last_crawl_status === 'running' && (
                            <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                ĐANG CÀO...
                            </div>
                        )}
                        {source.last_crawl_status === 'completed' && (
                            <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                Vừa cào xong
                            </div>
                        )}
                        {source.last_crawl_status === 'error' && (
                             <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                                <AlertCircle className="w-3 h-3" />
                                Lỗi crawl
                            </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button 
                        size="icon" 
                        variant="outline" 
                        onClick={() => triggerCrawl(source.id)} 
                        title="Cào ngay"
                        disabled={source.last_crawl_status === 'running'}
                    >
                        {source.last_crawl_status === 'running' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        ) : (
                            <Play className="w-4 h-4 text-green-600" />
                        )}
                     </Button>
                     <Button size="icon" variant="outline" onClick={() => openEditModal(source)} title="Sửa">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                     </Button>
                     {source.last_crawl_status !== 'idle' && (
                         <Button size="icon" variant="outline" onClick={() => resetStatus(source.id)} title="Reset trạng thái">
                            <RefreshCw className="w-4 h-4 text-orange-500" />
                         </Button>
                     )}
                     <Button size="icon" variant="outline" onClick={() => handleDeleteSource(source.id)} title="Xoá">
                        <Trash2 className="w-4 h-4 text-red-600" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Thêm/Sửa Nguồn */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa nguồn cào" : "Thêm kênh / nguồn cào mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên gợi nhớ (VD: Kênh Schannel)</Label>
              <Input 
                id="name" 
                placeholder="Nhập tên kênh / hashtag" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Danh mục Niche (Tuỳ chọn)</Label>
              <Select value={newCategoryId} onValueChange={(val) => setNewCategoryId(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục để gán trend..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Không phân loại --</SelectItem>
                  {categories.map(c => (
                     <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phân loại nguồn</Label>
              <Select value={newType} onValueChange={(val) => val && setNewType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại nguồn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok_profile">TikTok Profile (1 Kênh)</SelectItem>
                  <SelectItem value="tiktok_profile_list">Danh sách nhiều kênh TikTok</SelectItem>
                  <SelectItem value="tiktok_hashtag">TikTok Hashtag</SelectItem>
                  <SelectItem value="facebook_page">Facebook Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL hoặc ID</Label>
              <Input 
                id="url" 
                placeholder={newType === 'tiktok_profile_list' ? "VD: schannelvn, misthy, tocngan" : "VD: schannelvn hoặc https://tiktok.com/@schannel"} 
                value={newUrl} 
                onChange={(e) => setNewUrl(e.target.value)} 
              />
              <p className="text-xs text-gray-500">
                {newType === 'tiktok_profile_list' ? "Nhập nhiều ID kênh cách nhau bằng dấu phẩy (,)" : "Đối với TikTok Profile, nhập ID kênh (VD: tocngan). Với Hashtag, nhập tên không có dấu # (VD: xuhuong)."}
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSaveSource} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu nguồn cào'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
