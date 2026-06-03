"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Edit2, Trash2, Users } from "lucide-react";

export default function TelegramGroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [groupName, setGroupName] = useState("");
  const [chatId, setChatId] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('telegram_groups')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Lỗi tải danh sách nhóm");
    } else {
      setGroups(data || []);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingId(null);
    setGroupName("");
    setChatId("");
    setIsModalOpen(true);
  }

  const openEditModal = (group: any) => {
    setEditingId(group.id);
    setGroupName(group.group_name);
    setChatId(group.chat_id);
    setIsModalOpen(true);
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá nhóm này? Bạn sẽ cần cập nhật lại các danh mục đang dùng nhóm này nếu có.")) return;
    
    const { error } = await supabase
      .from('telegram_groups')
      .delete()
      .eq('id', id);
 
    if (error) {
      toast.error("Lỗi khi xoá: " + error.message);
    } else {
      toast.success("Đã xoá nhóm");
      fetchGroups();
    }
  }

  const handleSave = async () => {
    if (!groupName || !chatId) {
      toast.error("Vui lòng nhập đủ Tên nhóm và Chat ID");
      return;
    }

    setIsSubmitting(true);
    
    const payload = { 
      group_name: groupName,
      chat_id: chatId
    };

    let error;
    if (editingId) {
       const { error: updateError } = await supabase
        .from('telegram_groups')
        .update(payload)
        .eq('id', editingId);
       error = updateError;
    } else {
       const { error: insertError } = await supabase
        .from('telegram_groups')
        .insert([payload]);
       error = insertError;
    }

    setIsSubmitting(false);

    if (error) {
      toast.error("Lỗi khi lưu: " + error.message);
    } else {
      toast.success(editingId ? "Đã cập nhật nhóm" : "Đã thêm mới nhóm");
      setIsModalOpen(false);
      fetchGroups();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nhóm Telegram</h2>
          <p className="text-sm text-gray-500">Quản lý các nhóm để nhận thông báo Trends</p>
        </div>
        <Button onClick={openAddModal} variant="default" className="flex items-center gap-2">
          <Users className="w-4 h-4" /> Thêm Nhóm Mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Nhóm & Chat ID</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên Nhóm</TableHead>
                <TableHead>Chat ID</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500">Chưa có nhóm nào. Vui lòng thêm nhóm.</TableCell></TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.group_name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{g.chat_id}</span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button size="icon" variant="outline" onClick={() => openEditModal(g)} title="Sửa">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                     </Button>
                     <Button size="icon" variant="outline" onClick={() => handleDelete(g.id)} title="Xoá">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Nhóm" : "Thêm Nhóm Telegram"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên gợi nhớ (VD: Nhóm Thời Trang)</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nhập tên nhóm..." />
            </div>
            <div className="space-y-2">
              <Label>Telegram Chat ID (VD: -100123456789)</Label>
              <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-100..." />
              <p className="text-xs text-gray-500">
                Hãy dùng Bot lấy ID hoặc dùng Telegram Web để lấy mã số này (bao gồm cả dấu trừ).
              </p>
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
