"use client";

import React from "react";
import {
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Award,
  Tag,
  CheckCircle2,
} from "lucide-react";
import type { TrainingOpportunity } from "@/lib/career/training-service";

interface TrainingOpportunityCardProps {
  training: TrainingOpportunity;
}

export default function TrainingOpportunityCard({ training }: TrainingOpportunityCardProps) {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all space-y-4 group">
      {/* HEADER: BADGES & PROVIDER */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Training &amp; Bootcamp
            </span>
            {training.isVerified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>✓ Saarvi Verified</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Training Source &bull; Not Verified
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {training.mode}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {training.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{training.provider}</p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-800 block">
            {training.fee}
          </span>
        </div>
      </div>

      {/* DESCRIPTION */}
      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {training.description}
      </p>

      {/* SKILLS */}
      {training.skills && training.skills.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {training.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700"
            >
              {skill}
            </span>
          ))}
          {training.skills.length > 5 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">+{training.skills.length - 5} more</span>
          )}
        </div>
      )}

      {/* METADATA STRIP */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>{training.durationText}</span>
        </div>
        {training.startDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>Starts {new Date(training.startDate).toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>{training.certificateAvailable ? "Certificate Included" : "No Certificate"}</span>
        </div>
        {training.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            <span className="truncate">{training.location}</span>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="pt-2 flex items-center justify-between gap-3">
        <div className="text-[10px] text-slate-400 dark:text-slate-500">
          {training.deadline && `Deadline: ${new Date(training.deadline).toLocaleDateString()}`}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={training.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Apply Now</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
