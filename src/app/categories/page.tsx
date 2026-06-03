"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Edit2, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [telegramGroups, setTelegramGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [minVideos, setMinVideos] = useState("1");
  const [minChannels, setMinChannels] = useState("1");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [quantitativeWeight, setQuantitativeWeight] = useState("");
  const [velocityWeight, setVelocityWeight] = useState("");
  const [minViewsViral, setMinViewsViral] = useState("");
  const [minViews, setMinViews] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchCategories();
    fetchTelegramGroups();
  }, []);

  const fetchTelegramGroups = async () => {
    const { data } = await supabase.from('telegram_groups').select('chat_id, group_name');
    if (data) setTelegramGroups(data);
  };

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Lỗi tải danh mục");
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCustomPrompt("Bạn là một chuyên gia phân tích dữ liệu mạng xã hội. Hãy tìm ra các xu hướng (trend) nổi bật nhất từ danh sách video sau...");
    setMinVideos("1");
    setMinChannels("1");
    setTelegramChatId("");
    setQuantitativeWeight("");
    setVelocityWeight("");
    setMinViewsViral("");
    setMinViews("");
    setIsModalOpen(true);
  }

  const openEditModal = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || "");
    setCustomPrompt(cat.custom_prompt || "");
    setMinVideos(cat.min_videos?.toString() || "1");
    setMinChannels(cat.min_channels?.toString() || "1");
    setTelegramChatId(cat.telegram_chat_id || "");
    setQuantitativeWeight(cat.trend_score_quantitative_weight?.toString() || "");
    setVelocityWeight(cat.trend_score_velocity_weight?.toString() || "");
    setMinViewsViral(cat.trend_score_min_views_viral?.toString() || "");
    setMinViews(cat.min_views?.toString() || "");
    setIsModalOpen(true);
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá danh mục này sẽ ảnh hưởng đến các nguồn và dữ liệu đang liên kết. Bạn có chắc chắn?")) return;
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
 
    if (error) {
      toast.error("Lỗi khi xoá: " + error.message);
    } else {
      toast.success("Đã xoá danh mục");
      fetchCategories();
    }
  }

  const handleSave = async () => {
    if (!name) {
      toast.error("Vui lòng nhập tên danh mục");
      return;
    }

    setIsSubmitting(true);
    
    const payload = { 
      name, 
      description, 
      custom_prompt: customPrompt,
      min_videos: parseInt(minVideos) || 1,
      min_channels: parseInt(minChannels) || 1,
      telegram_chat_id: telegramChatId || null,
      trend_score_quantitative_weight: quantitativeWeight ? parseFloat(quantitativeWeight) : null,
      trend_score_velocity_weight: velocityWeight ? parseFloat(velocityWeight) : null,
      trend_score_min_views_viral: minViewsViral ? parseInt(minViewsViral) : null,
      min_views: minViews ? parseInt(minViews) : 0
    };

    let error;
    if (editingId) {
       const { error: updateError } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editingId);
       error = updateError;
    } else {
       const { error: insertError } = await supabase
        .from('categories')
        .insert([payload]);
       error = insertError;
    }

    setIsSubmitting(false);

    if (error) {
      toast.error("Lỗi khi lưu: " + error.message);
    } else {
      toast.success(editingId ? "Đã cập nhật" : "Đã thêm mới");
      setIsModalOpen(false);
      fetchCategories();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Danh mục Niche (Nhu cầu)</h2>
        <Button onClick={openAddModal} variant="default">Thêm Niche Mới</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phân loại các luồng phân tích AI</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên Niche</TableHead>
                <TableHead>Cấu hình Trend</TableHead>
                <TableHead>Prompt riêng</TableHead>
                <TableHead>Telegram Chat ID</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">Chưa có danh mục nào.</TableCell></TableRow>
              ) : categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">
                    <div>{cat.name}</div>
                    <div className="text-xs text-gray-500 font-normal">{cat.description}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded">≥ {cat.min_videos || 1} video | ≥ {cat.min_channels || 1} kênh</span>
                  </TableCell>
                  <TableCell>
                    {cat.custom_prompt ? (
                       <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Có Prompt</span>
                    ) : (
                       <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Mặc định</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cat.telegram_chat_id ? (
                      <span className="text-xs bg-blue-550 text-blue-700 font-mono font-medium px-2 py-1 bg-blue-50 border border-blue-100 rounded">{cat.telegram_chat_id}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Mặc định</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button size="icon" variant="outline" onClick={() => openEditModal(cat)} title="Sửa">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                     </Button>
                     <Button size="icon" variant="outline" onClick={() => handleDelete(cat.id)} title="Xoá">
                        <Trash2 className="w-4 h-4 text-red-600" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Niche" : "Thêm Niche mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên Niche (VD: Du học, Mỹ phẩm, KOL chung)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mô tả ngắn</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Số Video tối thiểu</Label>
                 <Input type="number" value={minVideos} onChange={(e) => setMinVideos(e.target.value)} />
               </div>
               <div className="space-y-2">
                 <Label>Số Kênh tối thiểu</Label>
                 <Input type="number" value={minChannels} onChange={(e) => setMinChannels(e.target.value)} />
               </div>
            </div>
            <div className="space-y-2">
              <Label>Nhóm Telegram nhận thông báo (Tùy chọn)</Label>
              <select 
                value={telegramChatId} 
                onChange={(e) => setTelegramChatId(e.target.value)} 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Dùng Telegram Mặc định --</option>
                {telegramGroups.map(g => (
                  <option key={g.chat_id} value={g.chat_id}>
                    {g.group_name} ({g.chat_id})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Bạn có thể thêm nhóm mới ở menu <b>Nhóm Telegram</b>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Custom Prompt (Hướng dẫn AI phân tích theo phong cách riêng)</Label>
              <Textarea 
                value={customPrompt} 
                onChange={(e) => setCustomPrompt(e.target.value)} 
                className="h-32 text-sm"
              />
              <p className="text-xs text-gray-500">
                Nếu bạn để trống, AI sẽ dùng Prompt mặc định. Gợi ý: Hãy thêm câu "Bạn là chuyên gia về mảng X... Hãy phân tích góc nhìn của khán giả Y...".
              </p>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-semibold text-sm text-gray-900">Cấu hình riêng cho Trend Score 2.0 & Lọc thô</h4>
              <p className="text-xs text-gray-500">Bỏ trống nếu muốn áp dụng các tham số mặc định của hệ thống.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tỷ trọng Điểm định lượng (%)</Label>
                  <Input type="number" placeholder="Mặc định: 70" value={quantitativeWeight} onChange={(e) => setQuantitativeWeight(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tỷ trọng Tốc độ lan truyền (%)</Label>
                  <Input type="number" placeholder="Mặc định: 60" value={velocityWeight} onChange={(e) => setVelocityWeight(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngưỡng view/giờ cực nóng</Label>
                  <Input type="number" placeholder="Mặc định: 15000" value={minViewsViral} onChange={(e) => setMinViewsViral(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lượt xem video tối thiểu</Label>
                  <Input type="number" placeholder="VD: 5000 (Lọc bài viết thô)" value={minViews} onChange={(e) => setMinViews(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu lại'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
