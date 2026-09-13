"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { studentService } from "@/lib/services/studentService";
import { sanitizeUrl } from "@/lib/security/url-security";
import { CertificateRecord } from "@/types/student";
import { checkCertificateDuplicate } from "@/lib/student/algorithms/duplicate-detector";
import {
  Award,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  Calendar,
  Filter,
  X,
  AlertCircle,
  FileCheck2,
} from "lucide-react";

const CATEGORIES = ["All", "Academic", "Course", "Competition", "Internship", "Other"] as const;

export default function CertificateOrganizerPage() {
  const [certs, setCerts] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<CertificateRecord["category"]>("Course");
  const [credentialId, setCredentialId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const loadCertificates = useCallback(async () => {
    try {
      const data = await studentService.getCertificates();
      setCerts(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const filteredCerts = useMemo(() => {
    return certs.filter((c) => {
      const matchesCat = selectedCategory === "All" || c.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        (c.credentialId && c.credentialId.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [certs, selectedCategory, searchQuery]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !issuer.trim()) {
      setErrorMsg("Please enter certificate title and issuer.");
      return;
    }

    // Duplicate detection check
    if (!duplicateWarning) {
      const dupCheck = checkCertificateDuplicate(
        { name: name.trim(), issuer: issuer.trim(), issueDate },
        certs
      );
      if (dupCheck.isDuplicate) {
        setDuplicateWarning(
          dupCheck.warningMessage || "A similar certificate already exists."
        );
        return;
      }
    }

    try {
      await studentService.saveCertificate({
        name: name.trim(),
        issuer: issuer.trim(),
        issueDate,
        category,
        credentialId: credentialId.trim() || undefined,
        verificationUrl: verificationUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowAddModal(false);
      setName("");
      setIssuer("");
      setCredentialId("");
      setVerificationUrl("");
      setNotes("");
      setDuplicateWarning(null);
      loadCertificates();
    } catch {
      setErrorMsg("Couldn't save certificate metadata. Local changes preserved.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studentService.deleteCertificate(id);
      loadCertificates();
    } catch {
      // Error handling
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <Award className="w-3.5 h-3.5" />
              <span>Credentials & Achievements</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Certificate Organizer
            </h1>
            <p className="text-sm text-slate-600">
              Track course credentials, verification URLs, and achievement IDs in one organized place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Certificate</span>
          </button>
        </div>

        {/* Privacy Shield Notice */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-3 text-xs text-blue-900">
          <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Zero Document Uploads: </span>
            <span>
              Saarvi does not upload your actual certificate PDF or JPG files to any server. Only structured reference metadata (issuer, date, credential ID, verification link) is stored for your convenience.
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by certificate title, issuer, or ID..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 bg-white rounded-3xl border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredCerts.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No certificates recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Record your course completions, hackathon badges, academic honors, and internship certificates.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Certificate</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCerts.map((c) => (
              <div
                key={c.id}
                className="p-5 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:shadow-md transition-all space-y-3 hover-3d-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {c.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 truncate mt-1">
                      {c.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      Issued by <span className="text-slate-900 font-semibold">{c.issuer}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Issued: {c.issueDate}</span>
                  </div>

                  {c.credentialId && (
                    <div className="text-[11px] font-mono text-slate-600">
                      ID: {c.credentialId}
                    </div>
                  )}

                  {c.verificationUrl && (
                    <a
                      href={sanitizeUrl(c.verificationUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Verify Credential</span>
                    </a>
                  )}

                  {c.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-1">
                      {c.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Certificate Modal */}
        {showAddModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cert-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowAddModal(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 id="modal-cert-title" className="text-base font-bold text-slate-900">Record Certificate</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close modal"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {duplicateWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">A similar certificate already exists:</strong>
                      <p className="text-amber-800 mt-0.5">{duplicateWarning}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        // Bypass duplicate check and save
                        setDuplicateWarning(null);
                        studentService.saveCertificate({
                          name: name.trim(),
                          issuer: issuer.trim(),
                          issueDate,
                          category,
                          credentialId: credentialId.trim() || undefined,
                          verificationUrl: verificationUrl.trim() || undefined,
                          notes: notes.trim() || undefined,
                        }).then(() => {
                          setShowAddModal(false);
                          setName("");
                          setIssuer("");
                          setCredentialId("");
                          setVerificationUrl("");
                          setNotes("");
                          loadCertificates();
                        });
                      }}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                    >
                      Save Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="px-3 py-1 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/50 rounded-lg font-semibold text-[11px] cursor-pointer"
                    >
                      Change Details
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="cert-name-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Certificate / Course Title
                  </label>
                  <input
                    id="cert-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. AWS Certified Cloud Practitioner"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="cert-issuer-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Issuing Organization
                    </label>
                    <input
                      id="cert-issuer-input"
                      type="text"
                      required
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                      placeholder="e.g. Amazon Web Services"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="cert-category-select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      id="cert-category-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CertificateRecord["category"])}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="Course">Online Course</option>
                      <option value="Academic">Academic Honor</option>
                      <option value="Competition">Competition / Hackathon</option>
                      <option value="Internship">Internship</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="cert-date-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Issue Date
                    </label>
                    <input
                      id="cert-date-input"
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="cert-cred-id" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Credential ID (Optional)
                    </label>
                    <input
                      id="cert-cred-id"
                      type="text"
                      value={credentialId}
                      onChange={(e) => setCredentialId(e.target.value)}
                      placeholder="e.g. ABC-12345"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="cert-verify-url" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Verification URL (Optional)
                  </label>
                  <input
                    id="cert-verify-url"
                    type="url"
                    value={verificationUrl}
                    onChange={(e) => setVerificationUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Save Certificate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
