import { supabase } from "@/lib/supabaseClient";

export type NoteRow = {
  id: string;
  class: string;
  subject: string;
  file_name: string;
  file_path: string;
  file_url: string;
  mime_type: string | null;
  size_kb: number | null;
  created_at: string;
};

const BUCKET = "notes";

export async function uploadNote(opts: {
  file: File;
  klass: string;
  subject: string;
}) {
  const { file, klass, subject } = opts;
  const safeName = file.name.replace(/\s+/g, "_");
  const filePath = `${klass}/${subject}/${Date.now()}_${safeName}`;

  // 1) upload to storage
  const { error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  // 2) public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const url = urlData.publicUrl;

  // 3) insert metadata
  const { data, error } = await supabase
    .from("notes")
    .insert({
      class: klass,
      subject,
      file_name: file.name,
      file_path: filePath,
      file_url: url,
      mime_type: file.type || null,
      size_kb: Math.round(file.size / 1024),
    })
    .select()
    .single();

  if (error) throw error;
  return data as NoteRow;
}

export async function listNotes(klass: string, subject: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("class", klass)
    .eq("subject", subject)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as NoteRow[];
}

export async function deleteNoteAndFile(row: NoteRow) {
  // Row first: RLS lets only the uploader delete it (13), so a refused delete leaves the file alone.
  const { data: deleted, error } = await supabase.from("notes").delete().eq("id", row.id).select("id");
  if (error) throw error;
  if (!deleted || deleted.length === 0) throw new Error("You can only delete notes you uploaded.");
  // Then the file (storage policy a4_notes_delete_own, 18). Errors were ignored before → orphan files.
  const { error: fileErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
  if (fileErr) console.warn("Note deleted but its file could not be removed:", fileErr.message);
}
