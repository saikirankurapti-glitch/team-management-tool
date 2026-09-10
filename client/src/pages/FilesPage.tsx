import React, { useState, useEffect } from 'react';
import { FileText, Download, Upload, Search } from 'lucide-react';
import { fetchApi } from '../services/api';
import { Project } from '../types';

export const FilesPage: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadFiles = () => {
    let query = '';
    if (selectedProjectId) query += `projectId=${selectedProjectId}`;

    Promise.all([
      fetchApi<any[]>(`/files?${query}`),
      fetchApi<Project[]>('/projects'),
    ])
      .then(([fileData, projData]) => {
        setFiles(fileData);
        setProjects(projData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadFiles();
  }, [selectedProjectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const formData = new FormData();
    formData.append('file', file);
    if (selectedProjectId) formData.append('projectId', selectedProjectId);

    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      loadFiles();
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredFiles = files.filter((f) => f.filename.toLowerCase().includes(searchQuery.toLowerCase()));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading File Explorer...</div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-warm pb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-olive-soft flex items-center justify-center text-olive-dark">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary tracking-tight">
              File Browser
            </h1>
            <p className="text-ink-muted text-xs">
              Document specifications, architectural diagrams, and project assets
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="input-warm text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          <label className="btn-pill-primary btn-pill-sm cursor-pointer flex items-center space-x-1.5">
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Asset'}</span>
            <input type="file" onChange={handleFileUpload} disabled={isUploading} className="hidden" />
          </label>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="panel-cream p-3 flex items-center justify-between">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-warm pl-8 pr-3 text-xs w-full"
          />
        </div>
        <span className="font-mono text-ink-muted text-xs">{filteredFiles.length} files found</span>
      </div>

      {/* Files Table */}
      <div className="panel-cream overflow-hidden">
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Project / Context</th>
              <th>Size</th>
              <th>Owner</th>
              <th>Uploaded</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr key={file.id}>
                <td className="font-semibold">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-olive shrink-0" />
                    <span className="truncate max-w-sm text-ink-primary">{file.filename}</span>
                  </div>
                </td>
                <td className="font-medium text-ink-muted whitespace-nowrap">
                  {file.project?.name || 'General'}
                </td>
                <td className="font-mono text-ink-muted whitespace-nowrap">
                  {formatFileSize(file.fileSize)}
                </td>
                <td className="font-medium text-olive-dark whitespace-nowrap">
                  {file.uploadedBy?.fullName || 'User'}
                </td>
                <td className="font-mono text-ink-muted whitespace-nowrap">
                  {new Date(file.createdAt).toLocaleDateString()}
                </td>
                <td className="text-right whitespace-nowrap">
                  <a
                    href={`/api/files/${file.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-ink-muted hover:text-olive hover:bg-canvas-secondary rounded-full transition-colors inline-block"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </td>
              </tr>
            ))}
            {filteredFiles.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-muted italic">
                  No files found in directory.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
