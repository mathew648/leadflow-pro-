"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Camera, Zap, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function JobGalleryPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/jobs/portal/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading photos…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-1">Gallery not found</h2>
          <p className="text-gray-500 text-sm">This link may have expired or is no longer valid.</p>
        </div>
      </div>
    );
  }

  const job = data;
  const tenant = job.tenant;
  const brandColor = tenant?.primaryColor ?? "#3B82F6";
  const photos = job.photos ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={tenant.businessName} className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: brandColor }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-sm">{tenant?.businessName}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Job summary */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <p className="text-xs text-gray-500 mb-1">Job {job.jobNumber}</p>
          <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
          {job.completedAt && (
            <p className="text-sm text-green-700 mt-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Completed {formatDate(job.completedAt)}
            </p>
          )}
          {job.completionNotes && <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{job.completionNotes}</p>}
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4" /> Photos ({photos.length})
          </h2>
          {photos.length === 0 ? (
            <p className="text-sm text-gray-500">No photos available for this job.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p: any) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border hover:opacity-90 transition-opacity">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnailUrl || p.url} alt={p.caption ?? "Job photo"} className="w-full h-full object-cover" />
                    </div>
                    {p.caption && <p className="text-xs text-gray-500 mt-1 truncate">{p.caption}</p>}
                  </a>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">Tap any photo to view or download the full-size image.</p>
            </>
          )}
        </div>

        {(tenant?.phone || tenant?.email) && (
          <p className="text-center text-xs text-gray-400">
            Questions? Contact {tenant.businessName}
            {tenant.phone ? ` · ${tenant.phone}` : ""}
            {tenant.email ? ` · ${tenant.email}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
