"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StudentStore, StudentNote } from "@/lib/student/student-store";
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Download,
  Calendar,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export default function StudentNotesPage() {
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<StudentNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const refreshNotes = () => {
    const list = searchQuery ? StudentStore.searchNotes(searchQuery) : StudentStore.getNotes();
    setNotes(list);
  };

  useEffect(() => {
    refreshNotes();
  }, [searchQuery]);

  const handleCreateNew = () => {
    setSelectedNote(null);
    setTitle("");
    setContent("");
    setTagsInput("");
    setIsEditing(true);
  };

  const handleEditNote = (note: StudentNote) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setTagsInput(note.tags.join(", "));
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (selectedNote) {
      StudentStore.updateNote(selectedNote.id, { title, content, tags });
    } else {
      StudentStore.addNote({ title, content, tags });
    }

    setIsEditing(false);
    setSelectedNote(null);
    refreshNotes();
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this note permanently from local storage?")) {
      StudentStore.deleteNote(id);
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      refreshNotes();
    }
  };

  const handleExportTxt = (note: StudentNote) => {
    const blob = new Blob([`${note.title}\n\nTags: ${note.tags.join(", ")}\n\n${note.content}`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header & Breadcrumb */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/student" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Student Portal
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-semibold">Notes</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-600" />
              Private Study Notes
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> 100% Local Storage
            </span>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Note
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notes by title, keywords, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
          />
        </div>

        {isEditing ? (
          /* Note Editor */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {selectedNote ? "Edit Note" : "Create New Note"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Systems — Semaphores and Deadlocks"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. OS, Module 3, Exam Revision"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Content
                </label>
                <textarea
                  rows={10}
                  required
                  placeholder="Type your notes, equations, key definitions, or code snippets..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        ) : notes.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No notes yet</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Create and organize lecture notes, exam revision summaries, and definitions. Everything remains on your device.
            </p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create First Note
            </button>
          </div>
        ) : (
          /* Notes Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {note.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed mb-3 whitespace-pre-wrap">
                    {note.content}
                  </p>

                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {note.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
                        >
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExportTxt(note)}
                      title="Download as TXT"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditNote(note)}
                      title="Edit Note"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      title="Delete Note"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
