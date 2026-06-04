"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Brain, Trash2, Plus, Info, Edit } from "lucide-react";

export default function AIMemoryPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [newRuleType, setNewRuleType] = useState("grouping");
  const [newExampleCase, setNewExampleCase] = useState("");
  // AI Memory States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingMemory, setAddingMemory] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_feedback_memory')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        setMemories(data);
      }
    } catch (e) {
      console.warn("Bảng ai_feedback_memory chưa được khởi tạo");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (memory: any) => {
    setEditingId(memory.id);
    setNewFeedback(memory.user_feedback);
    setNewRuleType(memory.rule_type);
    setNewExampleCase(memory.example_case || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewFeedback("");
    setNewExampleCase("");
    setNewRuleType("grouping");
  };

  const handleSaveOrUpdate = async () => {
    if (!newFeedback.trim()) return;
    setAddingMemory(true);
    try {
      if (editingId) {
        // Cập nhật quy tắc
        const { error } = await supabase
          .from('ai_feedback_memory')
          .update({
            rule_type: newRuleType,
            user_feedback: newFeedback.trim(),
            example_case: newExampleCase.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) {
          toast.error("Lỗi khi cập nhật bộ nhớ: " + error.message);
        } else {
          toast.success("Đã cập nhật bài học thành công!");
          handleCancelEdit();
          fetchMemories();
        }
      } else {
        // Thêm bài học mới
        const { error } = await supabase
          .from('ai_feedback_memory')
          .insert({
            rule_type: newRuleType,
            user_feedback: newFeedback.trim(),
            example_case: newExampleCase.trim() || null,
            is_active: true
          });

        if (error) {
          toast.error("Lỗi khi thêm bộ nhớ: " + error.message);
        } else {
          toast.success("Đã dạy bài học mới cho AI thành công!");
          setNewFeedback("");
          setNewExampleCase("");
          fetchMemories();
        }
      }
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    }
    setAddingMemory(false);
  };

  const handleToggleMemory = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('ai_feedback_memory')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error("Lỗi khi cập nhật bộ nhớ: " + error.message);
    } else {
      toast.success("Đã cập nhật trạng thái bộ nhớ!");
      fetchMemories();
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài học này khỏi bộ nhớ AI?")) return;
    const { error } = await supabase
      .from('ai_feedback_memory')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Lỗi khi xóa bộ nhớ: " + error.message);
    } else {
      toast.success("Đã xóa bài học thành công!");
      fetchMemories();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="w-8 h-8 text-indigo-600" />
          <span>Bộ nhớ sửa lỗi của TrendAgent</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Dạy AI tự kiểm lỗi, tối ưu thuật toán gom nhóm và ghi nhớ các quy tắc sửa đổi của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Form thêm/sửa bài học */}
        <div className="lg:col-span-1">
          <Card className="h-fit border-indigo-100 shadow-sm shadow-indigo-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit className="w-5 h-5 text-amber-500 animate-none" />
                    <span>Sửa bài học</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-indigo-500" />
                    <span>Thêm bài học mới</span>
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {editingId ? 'Cập nhật lại quy tắc hoặc ví dụ sửa lỗi.' : 'Nhập góp ý, quy định hoặc ví dụ sửa lỗi để AI học.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rule_type" className="text-xs font-semibold">Phân loại lỗi</Label>
                <select 
                  id="rule_type"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                >
                  <option value="grouping">Gom nhóm (Grouping)</option>
                  <option value="naming">Đặt tên (Naming)</option>
                  <option value="region">Vùng miền (Region)</option>
                  <option value="general">Lỗi chung (General)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="feedback_text" className="text-xs font-semibold">Quy tắc / Bài học cho AI</Label>
                <textarea 
                  id="feedback_text"
                  className="w-full h-24 p-2.5 rounded-md border text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ví dụ: Không được gom các vụ scandal hoặc đám cưới của người nổi tiếng khác nhau vào cùng một nhóm lớn..."
                  value={newFeedback}
                  onChange={(e) => setNewFeedback(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="example_case" className="text-xs font-semibold">Ví dụ cụ thể (Tùy chọn)</Label>
                <textarea 
                  id="example_case"
                  className="w-full h-20 p-2.5 rounded-md border text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ví dụ: Trốn thuế Ji Chang Wook khác với siêu đám cưới Hà Du Quân."
                  value={newExampleCase}
                  onChange={(e) => setNewExampleCase(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleSaveOrUpdate} 
                  disabled={addingMemory || !newFeedback.trim()} 
                  className={`w-full text-white ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {addingMemory ? 'Đang xử lý...' : (editingId ? 'Cập nhật bài học' : 'Lưu bài học')}
                </Button>
                
                {editingId && (
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit} 
                    className="w-full"
                  >
                    Hủy chỉnh sửa
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: Danh sách các bài học hiện tại */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-500" />
                <span>Quy tắc đang hoạt động ({memories.length})</span>
              </CardTitle>
              <CardDescription>
                Các quy tắc đang được AI nạp tự động vào prompt của bước Reduce.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-center text-gray-500">Đang tải bộ nhớ AI...</div>
              ) : memories.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Chưa có bài học nào được ghi nhớ</p>
                  <p className="text-xs text-slate-400 mt-1">Hãy tạo bài học mới ở form bên trái hoặc tự động lưu khi bấm Từ chối Trends.</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y overflow-hidden bg-white max-h-[500px] overflow-y-auto">
                  {memories.map((m) => (
                    <div key={m.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                            {m.rule_type}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${m.is_active ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-500'}`}>
                            {m.is_active ? 'Hoạt động' : 'Tắt'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 font-medium leading-relaxed">{m.user_feedback}</p>
                        {m.example_case && (
                          <div className="bg-slate-50 p-2 rounded text-xs text-gray-600 border border-slate-100">
                            <span className="font-semibold text-indigo-600">💡 Ví dụ minh họa:</span> {m.example_case}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" 
                          onClick={() => handleStartEdit(m)}
                        >
                          Sửa
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs font-semibold" 
                          onClick={() => handleToggleMemory(m.id, m.is_active)}
                        >
                          {m.is_active ? 'Tắt' : 'Bật'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 text-gray-400 hover:text-red-500 p-0" 
                          onClick={() => handleDeleteMemory(m.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
