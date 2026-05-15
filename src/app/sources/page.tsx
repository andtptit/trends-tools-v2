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
import { Edit2, Trash2, Play } from "lucide-react";

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

  const supabase = createClient();

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crawl_sources')
      .select('*')
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

  const openAddModal = () => {
    setEditingId(null);
    setNewName("");
    setNewType("tiktok_profile");
    setNewUrl("");
    setIsModalOpen(true);
  }

  const openEditModal = (source: any) => {
    setEditingId(source.id);
    setNewName(source.name);
    setNewType(source.type);
    setNewUrl(source.url);
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
    
    let error;
    if (editingId) {
       const { error: updateError } = await supabase
        .from('crawl_sources')
        .update({ name: newName, type: newType, url: newUrl })
        .eq('id', editingId);
       error = updateError;
    } else {
       const { error: insertError } = await supabase
        .from('crawl_sources')
        .insert([{ name: newName, type: newType, url: newUrl }]);
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
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{source.type}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{source.url}</TableCell>
                  <TableCell>
                    <Badge variant={source.is_active ? "default" : "secondary"}>
                      {source.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button size="icon" variant="outline" onClick={() => triggerCrawl(source.id)} title="Cào ngay">
                        <Play className="w-4 h-4 text-green-600" />
                     </Button>
                     <Button size="icon" variant="outline" onClick={() => openEditModal(source)} title="Sửa">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                     </Button>
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
              <Label>Phân loại nguồn</Label>
              <Select value={newType} onValueChange={(val) => setNewType(val)}>
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
