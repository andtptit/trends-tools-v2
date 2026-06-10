"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Info, Brain, Copy, Check, Cpu } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    crawl_limit: "5",
    actor_tiktok_profile: "clockworks/tiktok-profile",
    actor_tiktok_scraper: "clockworks/tiktok-scraper",
    base_ai_prompt: "Bạn là một chuyên gia phân tích dữ liệu mạng xã hội và nghiên cứu xu hướng (Trend Analyst). Hãy khắt khe trong việc đánh giá và đưa ra kịch bản thật viral.",
    trend_score_quantitative_weight: "70",
    trend_score_velocity_weight: "60",
    trend_score_min_views_viral: "15000",
    enable_realtime_frequency: "true"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [domain, setDomain] = useState("http://localhost:3000");
  const [cronSecret, setCronSecret] = useState("qua_trinh_phan_tich_tu_dong_2026");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
    fetchCategories();
    if (typeof window !== "undefined") {
      setDomain(window.location.origin);
    }
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (data) {
        const newSettings = { ...settings };
        data.forEach(item => {
          if (item.key in newSettings) {
            // @ts-ignore
            newSettings[item.key] = item.value;
          }
        });
        setSettings(newSettings);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const upsertData = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('system_settings')
      .upsert(upsertData);

    if (error) {
      toast.error("Lỗi khi lưu cài đặt: " + error.message);
    } else {
      toast.success("Đã lưu cài đặt thành công!");
    }
    setSaving(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('id, name');
      if (data) setCategories(data);
    } catch (e) {
      console.error("Lỗi khi tải danh mục:", e);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Đã copy thành công!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <div className="p-8">Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-3xl font-bold tracking-tight">Cài đặt hệ thống</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình Crawler</CardTitle>
          <CardDescription>Điều chỉnh các tham số và Actor ID để cào dữ liệu từ Apify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="limit">Số lượng bài viết/video tối đa mỗi lần cào</Label>
            <Input 
              id="limit" 
              type="number" 
              value={settings.crawl_limit} 
              onChange={(e) => updateSetting('crawl_limit', e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actor_profile">Actor ID cho Profile/Kênh</Label>
              <Input 
                id="actor_profile" 
                value={settings.actor_tiktok_profile} 
                onChange={(e) => updateSetting('actor_tiktok_profile', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor_scraper">Actor ID cho Hashtag</Label>
              <Input 
                id="actor_scraper" 
                value={settings.actor_tiktok_scraper} 
                onChange={(e) => updateSetting('actor_tiktok_scraper', e.target.value)} 
              />
            </div>
          </div>

          <div className="flex items-start space-x-2.5 pt-2">
            <input 
              id="enable_frequency" 
              type="checkbox"
              checked={settings.enable_realtime_frequency === "true"} 
              onChange={(e) => updateSetting('enable_realtime_frequency', e.target.checked ? "true" : "false")} 
              className="w-4 h-4 cursor-pointer rounded border-gray-300 text-purple-600 focus:ring-purple-500 mt-1"
            />
            <div className="space-y-1">
              <Label htmlFor="enable_frequency" className="cursor-pointer font-bold text-slate-800 text-sm">
                Kích hoạt Phân tích cụm từ & âm nhạc nổi bật ở trang Dữ liệu thô (Realtime Frequency Widget)
              </Label>
              <p className="text-xs text-gray-500">
                Hãy tắt tùy chọn này nếu lượng dữ liệu thô cào về cực lớn để tăng tốc độ tải trang Dữ liệu thô.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-sm text-blue-700">
            <Info className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Mẹo nhỏ:</p>
              <p>Nếu bạn gặp lỗi "Actor with this name was not found", có thể Actor đó đã bị đổi tên hoặc xóa trên Apify Store. Bạn có thể tìm ID mới tại <a href="https://apify.com/store" target="_blank" className="underline font-bold">Apify Store</a> và cập nhật vào đây.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Save className="w-5 h-5 text-blue-600"/> Cấu hình thuật toán Trend Score 2.0</CardTitle>
          <CardDescription>Tùy biến trọng số tính điểm và ngưỡng đột biến cho xu hướng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantitative_weight">Tỷ trọng Điểm định lượng (%)</Label>
              <Input 
                id="quantitative_weight" 
                type="number"
                min="0"
                max="100"
                value={settings.trend_score_quantitative_weight} 
                onChange={(e) => updateSetting('trend_score_quantitative_weight', e.target.value)} 
              />
              <p className="text-xs text-gray-500">Tỷ trọng còn lại ({100 - (parseInt(settings.trend_score_quantitative_weight) || 0)}%) sẽ thuộc về điểm định tính từ AI.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="velocity_weight">Tỷ trọng Tốc độ lan truyền trong điểm định lượng (%)</Label>
              <Input 
                id="velocity_weight" 
                type="number"
                min="0"
                max="100"
                value={settings.trend_score_velocity_weight} 
                onChange={(e) => updateSetting('trend_score_velocity_weight', e.target.value)} 
              />
              <p className="text-xs text-gray-500">Tỷ trọng còn lại ({100 - (parseInt(settings.trend_score_velocity_weight) || 0)}%) thuộc về Tỷ lệ tương tác.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_views_viral">Lượt xem/giờ để coi là cực nóng (100 điểm Tốc độ)</Label>
            <Input 
              id="min_views_viral" 
              type="number"
              value={settings.trend_score_min_views_viral} 
              onChange={(e) => updateSetting('trend_score_min_views_viral', e.target.value)} 
            />
            <p className="text-xs text-gray-500">Số lượt xem trung bình mỗi giờ đạt mốc này sẽ được quy đổi thành 100 điểm thành phần Tốc độ.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-purple-600"/> Cấu hình Trí tuệ Nhân tạo (AI)</CardTitle>
          <CardDescription>Thiết lập luật tối cao (Base Prompt) cho AI. Luật này sẽ áp dụng chung cho tất cả các Niche.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="base_prompt">Base System Prompt (Luật gốc cho AI)</Label>
            <Textarea 
              id="base_prompt" 
              className="h-32 text-sm"
              value={settings.base_ai_prompt} 
              onChange={(e) => updateSetting('base_ai_prompt', e.target.value)} 
            />
            <p className="text-xs text-gray-500">Đoạn text này sẽ là "luật tối cao" trước khi bắt đầu phân tích. Nó sẽ tự động kết hợp với Prompt của từng Niche mà bạn đã cài trong mục Danh mục.</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt AI'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Cpu className="w-5 h-5 text-blue-400" />
            Công cụ Tích hợp API (cho n8n / Cron Jobs)
          </CardTitle>
          <CardDescription className="text-slate-300 text-xs">
            Sinh mã URL API tự động kèm đầy đủ tham số để đưa vào các công cụ tự động hóa như n8n hoặc cron-job.org.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-xs text-blue-700 leading-relaxed">
            <Info className="w-5 h-5 shrink-0 text-blue-500" />
            <div>
              <p className="font-semibold mb-1">Hướng dẫn nhanh:</p>
              <p>Mặc định URL sử dụng tên miền hiện tại là <span className="font-mono bg-blue-100 px-1 rounded">{domain}</span>. Nếu chạy local và test webhook Apify, hãy nhập URL Tunnel công khai (như Ngrok) vào ô dưới đây để tự động thay đổi URL.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="api_domain" className="text-xs font-bold text-slate-500">Tên miền API (Domain)</Label>
              <Input 
                id="api_domain" 
                value={domain} 
                onChange={(e) => setDomain(e.target.value)} 
                className="text-xs"
                placeholder="Ví dụ: https://xxxx.ngrok-free.app hoặc https://trends-tools-v2.vercel.app"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="api_secret" className="text-xs font-bold text-slate-500">Mã bảo mật (CRON_SECRET)</Label>
              <Input 
                id="api_secret" 
                value={cronSecret} 
                onChange={(e) => setCronSecret(e.target.value)} 
                className="text-xs font-mono"
                placeholder="Nhập mã bảo mật của bạn"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Danh sách API theo từng Niche</h4>
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <Table className="w-full text-xs">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-28 font-bold text-slate-700">Niche (Danh mục)</TableHead>
                    <TableHead className="w-32 font-bold text-slate-700">ID Danh mục</TableHead>
                    <TableHead className="font-bold text-slate-700">Đường dẫn API tương ứng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Dành cho tất cả */}
                  <TableRow className="hover:bg-slate-50/50">
                    <TableCell className="font-bold text-slate-800">Tất cả Niche (All)</TableCell>
                    <TableCell className="font-mono text-slate-400">all</TableCell>
                    <TableCell className="space-y-2 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Cào dữ liệu (Apify)</span>
                            <span className="font-mono truncate select-all">{`${domain}/api/crawl/auto-run?secret=${cronSecret}&category_id=all`}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                            onClick={() => handleCopy(`${domain}/api/crawl/auto-run?secret=${cronSecret}&category_id=all`, 'crawl-all')}
                          >
                            {copiedId === 'crawl-all' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            Copy
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Kiểm tra trạng thái (Status Check)</span>
                            <span className="font-mono truncate select-all">{`${domain}/api/crawl/status?secret=${cronSecret}&category_id=all`}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                            onClick={() => handleCopy(`${domain}/api/crawl/status?secret=${cronSecret}&category_id=all`, 'status-all')}
                          >
                            {copiedId === 'status-all' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            Copy
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="truncate">
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Phân tích & Gộp AI (Gemini)</span>
                            <span className="font-mono truncate select-all">{`${domain}/api/cron/trigger-analysis?secret=${cronSecret}&category_id=all&hours=48`}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                            onClick={() => handleCopy(`${domain}/api/cron/trigger-analysis?secret=${cronSecret}&category_id=all&hours=48`, 'analysis-all')}
                          >
                            {copiedId === 'analysis-all' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            Copy
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Danh sách từng Niche */}
                  {categories.map((cat) => {
                    const crawlUrl = `${domain}/api/crawl/auto-run?secret=${cronSecret}&category_id=${cat.id}`;
                    const statusUrl = `${domain}/api/crawl/status?secret=${cronSecret}&category_id=${cat.id}`;
                    const analysisUrl = `${domain}/api/cron/trigger-analysis?secret=${cronSecret}&category_id=${cat.id}&hours=48`;
                    
                    return (
                      <TableRow key={cat.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800">{cat.name}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-slate-500 truncate max-w-[100px]" title={cat.id}>{cat.id}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 hover:bg-slate-200"
                              onClick={() => handleCopy(cat.id, `id-${cat.id}`)}
                            >
                              {copiedId === `id-${cat.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="space-y-2 py-3">
                          <div className="flex flex-col gap-1.5">
                            {/* Crawl URL */}
                            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="truncate">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Cào dữ liệu (Apify)</span>
                                <span className="font-mono truncate select-all">{crawlUrl}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                                onClick={() => handleCopy(crawlUrl, `crawl-${cat.id}`)}
                              >
                                {copiedId === `crawl-${cat.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                                Copy
                              </Button>
                            </div>
                            
                            {/* Status Check URL */}
                            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="truncate">
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Kiểm tra trạng thái (Status Check)</span>
                                <span className="font-mono truncate select-all">{statusUrl}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                                onClick={() => handleCopy(statusUrl, `status-${cat.id}`)}
                              >
                                {copiedId === `status-${cat.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                                Copy
                              </Button>
                            </div>

                            {/* Analysis URL */}
                            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="truncate">
                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Phân tích & Gộp AI (Gemini)</span>
                                <span className="font-mono truncate select-all">{analysisUrl}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 flex items-center gap-1 hover:bg-slate-200 shrink-0"
                                onClick={() => handleCopy(analysisUrl, `analysis-${cat.id}`)}
                              >
                                {copiedId === `analysis-${cat.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                                Copy
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2" variant="outline">
          <Save className="w-4 h-4" />
          {saving ? 'Đang lưu tất cả...' : 'Lưu tất cả cài đặt'}
        </Button>
      </div>
    </div>
  );
}
