import React, { useState } from 'react';
import { Languages, Database, Plus, Trash2, Edit3, Save, Copy, Check, Code, RefreshCw, FileCode, Server } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { i18nDbService } from '../../services/i18nDbService';
import { SysResource, SysEntityLocalization } from '../../types/i18nDb';
import { useLanguage } from '../../context/LanguageContext';
import { showToast } from '../../utils/toast';

export const I18nDbManager: React.FC = () => {
  const { refreshDbResources } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'resources' | 'entity_loc' | 'csharp_code'>('resources');
  const [resources, setResources] = useState<SysResource[]>(() => i18nDbService.getSysResources());
  const [entityLocalizations] = useState<SysEntityLocalization[]>(() => i18nDbService.getEntityLocalizations());

  // Edit / Add state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SysResource>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newResource, setNewResource] = useState<Partial<SysResource>>({
    categoryCode: 'CATALOG',
    cultureCode: 'vi',
    resourceKey: '',
    resourceValue: ''
  });

  // Copy state
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const csharpData = i18nDbService.getCSharpBackendCode();

  const handleEditClick = (item: SysResource) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editForm.resourceKey || !editForm.resourceValue) {
      showToast.error('Vui lòng nhập đầy đủ Resource Key và Giá trị dịch!');
      return;
    }
    const updated = i18nDbService.saveResource(editForm as SysResource);
    setResources(updated);
    setEditingId(null);
    refreshDbResources();
    showToast.success('Đã lưu bản dịch Database thành công!');
  };

  const handleDelete = (id: string) => {
    const updated = i18nDbService.deleteResource(id);
    setResources(updated);
    refreshDbResources();
    showToast.success('Đã xóa khóa dịch khỏi Database!');
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.resourceKey || !newResource.resourceValue) {
      showToast.error('Vui lòng nhập đầy đủ ResourceKey và ResourceValue!');
      return;
    }

    const item: SysResource = {
      id: `RES_${Date.now()}`,
      categoryCode: newResource.categoryCode || 'GENERAL',
      resourceKey: newResource.resourceKey.trim(),
      cultureCode: newResource.cultureCode || 'vi',
      resourceValue: newResource.resourceValue.trim(),
      updatedAt: new Date().toISOString().split('T')[0]
    };

    const updated = i18nDbService.saveResource(item);
    setResources(updated);
    setShowAddModal(false);
    setNewResource({ categoryCode: 'CATALOG', cultureCode: 'vi', resourceKey: '', resourceValue: '' });
    refreshDbResources();
    showToast.success('Đã tạo mới Resource Key trong Database!');
  };

  const handleResetSeed = () => {
    const reset = i18nDbService.resetToDefaultSeed();
    setResources(reset);
    refreshDbResources();
    showToast.success('Đã khôi phục dữ liệu mẫu i18n thành công!');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeKey(key);
    showToast.success('Đã sao chép mã nguồn vào bộ nhớ tạm!');
    setTimeout(() => setCopiedCodeKey(null), 2500);
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white border border-indigo-800/40 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/30 rounded-xl border border-indigo-500/30 shrink-0">
              <Languages className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide flex items-center gap-2">
                Hệ Thống Đa Ngôn Ngữ Lưu Trữ Trong Database (i18n Hybrid)
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] rounded-full font-bold">
                  C# EF Core Ready
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Khai báo nhãn dynamic (Bảng <code className="text-indigo-200 font-mono">SysResources</code>) và dịch trường danh mục (Bảng <code className="text-indigo-200 font-mono">SysEntityLocalizations</code>) để dùng trực tiếp cho C# Web API Backend.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSeed}
              className="text-white border-slate-700 hover:bg-slate-800"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Reset Seed Data
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Thêm Key Mới
            </Button>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('resources')}
          className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'resources'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Database className="h-4 w-4" />
          Bảng Resource Đa Ngôn Ngữ (`SysResources`) ({resources.length})
        </button>

        <button
          onClick={() => setActiveSubTab('entity_loc')}
          className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'entity_loc'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileCode className="h-4 w-4" />
          Bảng Dịch Trường Danh Mục (`SysEntityLocalizations`) ({entityLocalizations.length})
        </button>

        <button
          onClick={() => setActiveSubTab('csharp_code')}
          className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'csharp_code'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Code className="h-4 w-4" />
          Mẫu Code C# ASP.NET Core & SQL Server DDL
        </button>
      </div>

      {/* Tab 1: SysResources List & Editor */}
      {activeSubTab === 'resources' && (
        <Card title="Danh Sách Dữ Liệu Dịch Đa Ngôn Ngữ Khai Báo Trong DB">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Phân Nhóm (Category)</th>
                  <th className="p-3">Mã Khóa Resource (ResourceKey)</th>
                  <th className="p-3">Ngôn Ngữ (Culture)</th>
                  <th className="p-3">Giá Trị Dịch (ResourceValue)</th>
                  <th className="p-3">Cập Nhật</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {resources.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-semibold">
                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">
                          {item.categoryCode}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.resourceKey || ''}
                            onChange={(e) => setEditForm({ ...editForm, resourceKey: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono text-xs"
                          />
                        ) : (
                          item.resourceKey
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.cultureCode === 'vi' || item.cultureCode === 'vi-VN'
                            ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {item.cultureCode === 'vi' || item.cultureCode === 'vi-VN' ? '🇻🇳 vi-VN' : '🇺🇸 en-US'}
                        </span>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.resourceValue || ''}
                            onChange={(e) => setEditForm({ ...editForm, resourceValue: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          <span className="text-slate-800 dark:text-slate-200 font-medium">
                            {item.resourceValue}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 text-[11px] font-mono">
                        {item.updatedAt}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" onClick={handleSaveEdit} icon={<Save className="h-3.5 w-3.5" />}>
                              Lưu
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              Hủy
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded cursor-pointer"
                              title="Sửa bản dịch"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer"
                              title="Xóa khóa dịch"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: SysEntityLocalizations List */}
      {activeSubTab === 'entity_loc' && (
        <Card title="Dịch Các Trường Cụ Thể Trong Bảng Dữ Liệu (Master Data Localizations)">
          <p className="text-xs text-slate-500 mb-4">
            Bảng <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">SysEntityLocalizations</code> giúp dịch tên các Vật tư, Kho hàng, Đơn vị cơ sở... từ tiếng Việt sang các ngôn ngữ khác mà không làm phồng số cột trong bảng chính.
          </p>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Entity Target (Bảng)</th>
                  <th className="p-3">Entity ID (Khóa chính)</th>
                  <th className="p-3">Field (Tên trường)</th>
                  <th className="p-3">Culture</th>
                  <th className="p-3">Giá Trị Bản Dịch (LocalizedValue)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {entityLocalizations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.entityName}</td>
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{item.entityId}</td>
                    <td className="p-3 font-mono text-slate-500">{item.fieldName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-bold">
                        🇺🇸 en-US
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{item.localizedValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: C# ASP.NET Core & SQL DDL Code Generator */}
      {activeSubTab === 'csharp_code' && (
        <div className="space-y-6">
          <Card title="1. Entity Classes (C# Entity Framework Core)">
            <div className="relative">
              <button
                onClick={() => copyToClipboard(csharpData.csharpEntities, 'entities')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedCodeKey === 'entities' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCodeKey === 'entities' ? 'Đã copy' : 'Copy C# Code'}</span>
              </button>
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed custom-scrollbar max-h-80">
                {csharpData.csharpEntities}
              </pre>
            </div>
          </Card>

          <Card title="2. ASP.NET Core Web API Controller (`I18nController.cs`)">
            <div className="relative">
              <button
                onClick={() => copyToClipboard(csharpData.csharpController, 'controller')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedCodeKey === 'controller' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCodeKey === 'controller' ? 'Đã copy' : 'Copy C# API Code'}</span>
              </button>
              <pre className="p-4 bg-slate-950 text-blue-300 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed custom-scrollbar max-h-80">
                {csharpData.csharpController}
              </pre>
            </div>
          </Card>

          <Card title="3. SQL DDL Table Script (SQL Server / PostgreSQL)">
            <div className="relative">
              <button
                onClick={() => copyToClipboard(csharpData.sqlScript, 'sql')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedCodeKey === 'sql' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCodeKey === 'sql' ? 'Đã copy' : 'Copy SQL Script'}</span>
              </button>
              <pre className="p-4 bg-slate-950 text-amber-300 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed custom-scrollbar max-h-60">
                {csharpData.sqlScript}
              </pre>
            </div>
          </Card>
        </div>
      )}

      {/* Add New Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Khai Báo Dữ Liệu Đa Ngôn Ngữ Database Mới
            </h3>

            <form onSubmit={handleCreateNew} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400">Phân Nhóm Category</label>
                <select
                  value={newResource.categoryCode}
                  onChange={(e) => setNewResource({ ...newResource, categoryCode: e.target.value as any })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="MENU">MENU (Phân hệ & Menu)</option>
                  <option value="CATALOG">CATALOG (Danh mục master)</option>
                  <option value="SYSTEM">SYSTEM (Hệ thống)</option>
                  <option value="REPORT">REPORT (Báo cáo)</option>
                  <option value="VALIDATION">VALIDATION (Thông báo lỗi)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400">Mã Khóa ResourceKey (C# IStringLocalizer key)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sys.catalog.new_feature"
                  value={newResource.resourceKey}
                  onChange={(e) => setNewResource({ ...newResource, resourceKey: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400">Mã Ngôn Ngữ (Culture)</label>
                  <select
                    value={newResource.cultureCode}
                    onChange={(e) => setNewResource({ ...newResource, cultureCode: e.target.value as any })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="vi">🇻🇳 vi-VN (Tiếng Việt)</option>
                    <option value="en">🇺🇸 en-US (English)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400">Giá Trị Nội Dung Dịch</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tính năng mới"
                    value={newResource.resourceValue}
                    onChange={(e) => setNewResource({ ...newResource, resourceValue: e.target.value })}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Hủy Bỏ
                </Button>
                <Button type="submit" icon={<Save className="h-4 w-4" />}>
                  Thêm VÀO DB
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
