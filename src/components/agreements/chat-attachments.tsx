"use client";

import { FileArrowUp, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

type Upload = { id: string; name: string; progress: number; status: "uploading" | "ready" | "failed"; message?: string };
const accept = "image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const RemoveIcon = () => <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>;

async function callAttachments(body: Record<string, unknown>) {
  const supabase = createClient(); const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again.");
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/functions/v1/conversation-attachments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Attachment request failed.");
  return { payload, token, url, key };
}

export function ChatAttachmentUploader({ agreementId }: { agreementId: string }) {
  const [uploads, setUploads] = useState<Upload[]>([]); const requests = useRef(new Map<string, XMLHttpRequest>());
  async function upload(file: File) {
    const tempId = crypto.randomUUID();
    if (uploads.length >= 5) return;
    setUploads((items) => [...items, { id: tempId, name: file.name, progress: 0, status: "uploading" }]);
    try {
      const { payload, token, url, key } = await callAttachments({ action: "prepare", agreementId, name: file.name, mediaType: file.type, size: file.size });
      const attachmentId = String(payload.attachmentId); const objectPath = String(payload.objectPath);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); requests.current.set(attachmentId, xhr);
        xhr.open("POST", `${url}/storage/v1/object/conversation-attachments/${objectPath.split("/").map(encodeURIComponent).join("/")}`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`); xhr.setRequestHeader("apikey", key); xhr.setRequestHeader("Content-Type", file.type); xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploads((items) => items.map((item) => item.id === tempId ? { ...item, progress: Math.round(event.loaded / event.total * 100) } : item)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Private upload failed."));
        xhr.onerror = () => reject(new Error("Upload was interrupted.")); xhr.onabort = () => reject(new Error("Upload cancelled.")); xhr.send(file);
      });
      requests.current.delete(attachmentId);
      setUploads((items) => items.map((item) => item.id === tempId ? { id: attachmentId, name: file.name, progress: 100, status: "ready" } : item));
    } catch (error) { setUploads((items) => items.map((item) => item.id === tempId ? { ...item, status: "failed", message: error instanceof Error ? error.message : "Upload failed." } : item)); }
  }
  async function remove(item: Upload) {
    requests.current.get(item.id)?.abort(); requests.current.delete(item.id);
    if (item.status === "ready") await callAttachments({ action: "cancel", attachmentId: item.id }).catch(() => undefined);
    setUploads((items) => items.filter((upload) => upload.id !== item.id));
  }
  return <div className="chat-attachments"><label className="file-input"><span>Add private files (optional)</span><input type="file" accept={accept} multiple disabled={uploads.length >= 5} onChange={(event) => { for (const file of Array.from(event.target.files ?? []).slice(0, 5 - uploads.length)) void upload(file); event.currentTarget.value = ""; }} /></label><small>Up to five JPG, PNG, WebP, MP4, WebM, PDF, TXT, or DOCX files; 25 MB each. Files are private and links expire.</small>{uploads.length > 0 && <ul>{uploads.map((item) => <li key={item.id}><input type="hidden" name="attachmentIds" value={item.status === "ready" ? item.id : ""} /><span>{item.status === "uploading" ? <SpinnerGap className="spinner" /> : item.status === "failed" ? <WarningCircle /> : <FileArrowUp />}{item.name}</span>{item.status === "uploading" && <progress max={100} value={item.progress}>{item.progress}%</progress>}{item.message && <small role="alert">{item.message}</small>}<button type="button" className="text-action" onClick={() => void remove(item)} aria-label={`Remove ${item.name}`}><RemoveIcon /> Remove</button></li>)}</ul>}</div>;
}

export function ChatAttachmentLink({ attachment }: { attachment: { id: string; original_name: string; media_type: string; size_bytes: number } }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div className="chat-attachment-link"><FileArrowUp /><div><strong>{attachment.original_name}</strong><small>{attachment.media_type} · {(attachment.size_bytes / 1_048_576).toFixed(1)} MB</small></div><button type="button" className="button button-quiet" disabled={busy} onClick={async () => { const popup = window.open("about:blank", "_blank"); setBusy(true); setError(""); try { const { payload } = await callAttachments({ action: "download", attachmentId: attachment.id }); if (!popup) throw new Error("Allow pop-ups to open this private file."); popup.opener = null; popup.location.href = String(payload.url); } catch (caught) { popup?.close(); setError(caught instanceof Error ? caught.message : "File unavailable."); } finally { setBusy(false); } }}>{busy ? "Preparing…" : "Open for 60 seconds"}</button>{error && <small role="alert">{error}</small>}</div>;
}
