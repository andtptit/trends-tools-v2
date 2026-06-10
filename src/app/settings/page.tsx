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
  const [activeTab, setActiveTab] = useState<"system" | "api">("system");
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

  // States for API URL Generator
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [apiLimit, setApiLimit] = useState("");
  const [apiHour, setApiHour] = useState("48");
  const [apiIsAnalyzed, setApiIsAnalyzed] = useState("false");

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

  const getCategoryName = (id: string) => {
    if (id === "all") return "Tất cả Niche (All)";
    if (id === "global") return "Kênh toàn cầu (Global)";
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : id;
  };

  const getCrawlUrl = () => {
    const params = new URLSearchParams();
    params.set("secret", cronSecret);
    params.set("category_id", selectedNiche);
    if (apiLimit) {
      params.set("limit", apiLimit);
    }
    return `${domain}/api/crawl/auto-run?${params.toString()}`;
  };

  const getStatusUrl = () => {
    const params = new URLSearchParams();
    params.set("secret", cronSecret);
    params.set("category_id", selectedNiche);
    return `${domain}/api/crawl/status?${params.toString()}`;
  };

  const getAnalysisUrl = () => {
    const params = new URLSearchParams();
    params.set("secret", cronSecret);
    params.set("category_id", selectedNiche);
    if (apiHour) {
      params.set("hours", apiHour);
    }
    if (apiLimit) {
      params.set("limit", apiLimit);
    }
    params.set("is_analyzed", apiIsAnalyzed);
    return `${domain}/api/cron/trigger-analysis?${params.toString()}`;
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800">Cài đặt hệ thống</h2>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("system")}
          className={`pb-3 pt-1 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "system"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Cấu hình hệ thống
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`pb-3 pt-1 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "api"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Công cụ tích hợp API
        </button>
      </div>

      {activeTab === "system" ? (
        <div className="space-y-6">
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
            </CardContent>
          </Card>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium">
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu tất cả...' : 'Lưu tất cả cài đặt'}
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Cpu className="w-5 h-5 text-blue-400" />
              Công cụ Tích hợp API (cho n8n / Cron Jobs)
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              Chọn các tham số mong muốn bên dưới, các URL API tích hợp sẽ tự động sinh và hiển thị tương ứng ở cuối trang.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-xs text-blue-700 leading-relaxed">
              <Info className="w-5 h-5 shrink-0 text-blue-500" />
              <div>
                <p className="font-semibold mb-1">Hướng dẫn tích hợp:</p>
                <p>Mặc định URL sử dụng tên miền hiện tại là <span className="font-mono bg-blue-100 px-1 rounded">{domain}</span>. Bạn có thể sửa ô dưới đây để đổi sang URL Ngrok (khi chạy local) hoặc URL Vercel/Staging production của bạn.</p>
              </div>
            </div>

            {/* API URL Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="api_domain" className="text-xs font-bold text-slate-600">Tên miền API (Domain)</Label>
                <Input 
                  id="api_domain" 
                  value={domain} 
                  onChange={(e) => setDomain(e.target.value)} 
                  className="text-xs focus:ring-purple-500"
                  placeholder="Ví dụ: https://xxxx.ngrok-free.app hoặc https://trends-tools-v2.vercel.app"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_secret" className="text-xs font-bold text-slate-600">Mã bảo mật (CRON_SECRET)</Label>
                <Input 
                  id="api_secret" 
                  value={cronSecret} 
                  onChange={(e) => setCronSecret(e.target.value)} 
                  className="text-xs font-mono focus:ring-purple-500"
                  placeholder="Nhập mã bảo mật của bạn"
                />
              </div>
            </div>

            {/* Filter Params Form */}
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200/60 pb-2">
                Bộ lọc tham số API
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="niche_select" className="text-xs font-bold text-slate-700">Niche (Danh mục)</Label>
                  <select
                    id="niche_select"
                    value={selectedNiche}
                    onChange={(e) => setSelectedNiche(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500"
                  >
                    <option value="all">Tất cả Niche (All)</option>
                    <option value="global">Kênh toàn cầu (Global)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.id.substring(0, 8)}...)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="api_limit" className="text-xs font-bold text-slate-700">Limit (Giới hạn cào & phân tích)</Label>
                  <Input 
                    id="api_limit" 
                    type="number"
                    value={apiLimit} 
                    onChange={(e) => setApiLimit(e.target.value)} 
                    placeholder="Bỏ trống để dùng mặc định..."
                    className="text-xs focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="api_hour" className="text-xs font-bold text-slate-700">Hour (Khoảng thời gian phân tích - giờ)</Label>
                  <Input 
                    id="api_hour" 
                    type="number"
                    value={apiHour} 
                    onChange={(e) => setApiHour(e.target.value)} 
                    placeholder="48"
                    className="text-xs focus:ring-purple-500 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="is_analyzed_select" className="text-xs font-bold text-slate-700">is_analyzed (Đã phân tích hay chưa)</Label>
                  <select
                    id="is_analyzed_select"
                    value={apiIsAnalyzed}
                    onChange={(e) => setApiIsAnalyzed(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500"
                  >
                    <option value="false">Chưa phân tích (is_analyzed = false)</option>
                    <option value="true">Đã phân tích (is_analyzed = true)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Generated APIs Output */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="font-bold text-sm tracking-wide text-slate-800">
                Đường dẫn API của bạn cần dùng:
              </h4>
              <div className="space-y-3">
                {/* 1. Crawl URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      1. Cào dữ liệu (Apify Crawl API)
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-3 flex items-center gap-1 hover:bg-slate-100 border-slate-200 text-xs font-medium"
                      onClick={() => handleCopy(getCrawlUrl(), 'crawl-url')}
                    >
                      {copiedId === 'crawl-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      Copy URL
                    </Button>
                  </div>
                  <div className="font-mono text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto select-all mb-2 shadow-inner">
                    {getCrawlUrl()}
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    Kích hoạt cào cho <span className="font-bold text-slate-700">{getCategoryName(selectedNiche)}</span>{apiLimit ? `, giới hạn tối đa ${apiLimit} video mỗi nguồn` : ' (sử dụng giới hạn mặc định hệ thống)'}.
                  </p>
                </div>

                {/* 2. Status URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                      2. Kiểm tra trạng thái cào (Status Check API)
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-3 flex items-center gap-1 hover:bg-slate-100 border-slate-200 text-xs font-medium"
                      onClick={() => handleCopy(getStatusUrl(), 'status-url')}
                    >
                      {copiedId === 'status-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      Copy URL
                    </Button>
                  </div>
                  <div className="font-mono text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto select-all mb-2 shadow-inner">
                    {getStatusUrl()}
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    Kiểm tra xem quá trình cào cho <span className="font-bold text-slate-700">{getCategoryName(selectedNiche)}</span> đã hoàn thành hay chưa. Trả về trạng thái chạy ngầm để thiết lập luồng đợi trong n8n.
                  </p>
                </div>

                {/* 3. Analysis URL */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                      3. Phân tích & Gộp AI (Gemini Analysis API)
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-3 flex items-center gap-1 hover:bg-slate-100 border-slate-200 text-xs font-medium"
                      onClick={() => handleCopy(getAnalysisUrl(), 'analysis-url')}
                    >
                      {copiedId === 'analysis-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      Copy URL
                    </Button>
                  </div>
                  <div className="font-mono text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto select-all mb-2 shadow-inner">
                    {getAnalysisUrl()}
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    Kích hoạt phân tích AI cho <span className="font-bold text-slate-700">{getCategoryName(selectedNiche)}</span> với dữ liệu cào trong <span className="font-bold text-slate-700">{apiHour || '48'} giờ</span> qua, giới hạn tối đa <span className="font-bold text-slate-700">{apiLimit || '300'}</span> bài viết, lọc trạng thái <span className="font-bold text-slate-700">is_analyzed = {apiIsAnalyzed}</span>.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
