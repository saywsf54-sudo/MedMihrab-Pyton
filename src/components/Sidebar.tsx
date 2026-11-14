import React, { useState } from 'react';
import { Plus, FileText, Trash2, Edit2, Copy, Search, Check, X, Folder, HardDrive } from 'lucide-react';
import { ProjectFile } from '../App';

interface SidebarProps {
  files: ProjectFile[];
  activeFileId: string;
  onFileSelect: (id: string) => void;
  onFileAdd: () => void;
  onFileDelete: (id: string) => void;
  onFileRename?: (id: string, newName: string) => void;
  onFileDuplicate?: (id: string) => void;
  className?: string;
}

export default function Sidebar({
  files,
  activeFileId,
  onFileSelect,
  onFileAdd,
  onFileDelete,
  onFileRename,
  onFileDuplicate,
  className = "w-[240px] border-l border-[#e2e8f0] dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 hidden md:flex"
}: SidebarProps) {
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleStartRename = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditingName(file.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim() && onFileRename) {
      let finalName = editingName.trim();
      const original = files.find(f => f.id === id);
      const originalExt = original?.name.match(/\.[a-z0-9]+$/i)?.[0] || '.py';
      if (!/\.[a-z0-9]+$/i.test(finalName)) {
        finalName += originalExt;
      }
      onFileRename(id, finalName);
    }
    setEditingFileId(null);
  };

  const handleCancelRename = () => {
    setEditingFileId(null);
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <aside className={className} dir="rtl">
      {/* Sidebar Header */}
      <div className="p-3.5 text-[11px] font-bold flex justify-between items-center border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
        <span className="flex items-center gap-1.5 uppercase text-slate-500 dark:text-slate-400">
          <Folder size={14} className="text-amber-500" />
          مكتبة المخطوطات
        </span>
        <button
          onClick={onFileAdd}
          className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 p-1 rounded-md transition-colors flex items-center gap-1 text-[11px]"
          title="إضافة مخطوطة جديدة"
        >
          <Plus size={14} />
          <span className="hidden lg:inline">جديد</span>
        </button>
      </div>

      {/* File Search Input */}
      {files.length > 3 && (
        <div className="p-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search size={12} className="absolute right-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="البحث في المخطوطات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-7 pl-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex flex-col px-2 flex-1 overflow-y-auto py-2 space-y-0.5 custom-header-scroll" dir="rtl">
        {filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-400">لا توجد مخطوطات مطابقة</div>
        ) : (
          filteredFiles.map(file => {
            const isActive = file.id === activeFileId;
            const isEditing = editingFileId === file.id;

            return (
              <div 
                key={file.id}
                className={`px-2.5 py-1.5 text-[12px] flex items-center justify-between gap-2 rounded-lg my-0.5 cursor-pointer transition-all font-sans ${
                  isActive 
                    ? 'bg-amber-50 dark:bg-slate-800/90 text-amber-700 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-slate-700 shadow-xs' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => onFileSelect(file.id)}
                onMouseEnter={() => setHoveredFileId(file.id)}
                onMouseLeave={() => setHoveredFileId(null)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(file.id);
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      autoFocus
                      className="w-full px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 border border-amber-500 rounded text-slate-900 dark:text-slate-100 outline-none font-sans"
                    />
                    <button
                      onClick={() => handleSaveRename(file.id)}
                      className="text-emerald-500 hover:text-emerald-600 p-0.5"
                      title="حفظ الاسم"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelRename}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="إلغاء"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                      <FileText size={15} className={isActive ? 'text-amber-500 shrink-0' : 'text-slate-400 dark:text-slate-500 shrink-0'} /> 
                      <span className="truncate">{file.name}</span>
                    </div>

                    {/* Quick Hover Actions */}
                    {hoveredFileId === file.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        {onFileRename && (
                          <button
                            onClick={(e) => handleStartRename(file, e)}
                            className="text-slate-400 hover:text-amber-500 p-0.5 transition-colors"
                            title="إعادة تسمية المخطوطة"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {onFileDuplicate && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onFileDuplicate(file.id); }}
                            className="text-slate-400 hover:text-amber-500 p-0.5 transition-colors"
                            title="تكرار المخطوطة"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                        {files.length > 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onFileDelete(file.id); }} 
                            className="text-slate-400 hover:text-red-500 p-0.5 transition-colors"
                            title="حذف المخطوطة"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Storage Indicator */}
      <div className="mt-auto p-3.5 border-t border-[#e2e8f0] dark:border-slate-800 bg-[#f8f9fa] dark:bg-slate-950/50">
        <div className="flex items-center justify-between text-[11px] text-[#64748b] dark:text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <HardDrive size={13} className="text-amber-500" />
            التخزين المحلي الآمن
          </span>
          <span className="text-[10px] font-sans text-emerald-500 font-bold">نشط وحي</span>
        </div>
        <div className="h-1 bg-[#e2e8f0] dark:bg-slate-700 rounded-full my-2 flex justify-start overflow-hidden">
          <div className="w-[20%] h-full bg-amber-500 rounded-full"></div>
        </div>
        <div className="text-[10px] text-[#64748b] dark:text-slate-500 flex justify-between items-center font-sans">
          <span>{files.length} مخطوطات محفوظة</span>
          <span>مزامنة تلقائية</span>
        </div>
      </div>
    </aside>
  );
}
