import { supabase } from "./supabase";
import { rpc } from "./api";
import type { Asset } from "./model";
const LIMIT = 40 * 1024 * 1024;
export async function inspectImage(file: File, panorama = true) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !/\.(jpg|jpeg|png|webp)$/i.test(file.name)
  )
    throw new Error("Use uma fotografia JPEG, PNG ou WebP.");
  if (file.size > LIMIT || !file.size)
    throw new Error("O arquivo deve ter até 40 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
    webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    !(
      (file.type === "image/jpeg" && jpeg) ||
      (file.type === "image/png" && png) ||
      (file.type === "image/webp" && webp)
    )
  )
    throw new Error("O conteúdo não corresponde ao formato informado.");
  const bitmap = await createImageBitmap(file);
  if (
    bitmap.width > 32768 ||
    bitmap.height > 16384 ||
    (panorama && Math.abs(bitmap.width / bitmap.height - 2) > 0.03)
  ) {
    bitmap.close();
    throw new Error(
      "Use um panorama equiretangular 2:1, com até 32768 × 16384 pixels.",
    );
  }
  return bitmap;
}
async function uploadBlob(
  projectId: string,
  blob: Blob,
  width: number,
  height: number,
  kind: Asset["kind"],
  onProgress: (n: number) => void,
): Promise<Asset> {
  const id = crypto.randomUUID(),
    ext =
      blob.type === "image/png"
        ? "png"
        : blob.type === "image/webp"
          ? "webp"
          : "jpg",
    path = `projects/${projectId}/${kind}/${id}.${ext}`;
  const bytes = await blob.arrayBuffer();
  const sha256 = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão encerrada. Entre novamente.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/tour-media/${path}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader(
      "apikey",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("Cache-Control", "max-age=31536000");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Falha no envio da fotografia. Tente novamente."));
    xhr.onerror = () =>
      reject(new Error("Conexão interrompida. Envie novamente."));
    xhr.timeout = 120000;
    xhr.ontimeout = () =>
      reject(new Error("O envio excedeu o tempo. Tente novamente."));
    xhr.send(blob);
  });
  const asset: Asset = {
    id,
    project_id: projectId,
    path,
    content_type: blob.type,
    width,
    height,
    file_size: blob.size,
    sha256,
    kind,
    status: "ready",
  };
  await rpc("register_asset", { p_data: asset });
  onProgress(100);
  return asset;
}
export async function uploadPanorama(
  projectId: string,
  file: File,
  onProgress: (n: number) => void,
) {
  const bitmap = await inspectImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 240;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, 480, 240);
    const thumb = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Falha ao gerar miniatura.")),
        "image/webp",
        0.8,
      ),
    );
    const panorama = await uploadBlob(
      projectId,
      file,
      bitmap.width,
      bitmap.height,
      "panorama",
      (n) => onProgress(Math.round(n * 0.9)),
    );
    const thumbnail = await uploadBlob(
      projectId,
      thumb,
      480,
      240,
      "thumbnail",
      (n) => onProgress(90 + Math.round(n * 0.1)),
    );
    return { panorama, thumbnail };
  } finally {
    bitmap.close();
  }
}
export async function uploadBrandImage(
  projectId: string,
  file: File,
  kind: "social" | "logo",
  onProgress: (n: number) => void,
) {
  const bitmap = await inspectImage(file, false);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = kind === "social" ? 1200 : 400;
    canvas.height = kind === "social" ? 630 : 400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#10141c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale =
      kind === "social"
        ? Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height)
        : Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const w = bitmap.width * scale,
      h = bitmap.height * scale;
    ctx.drawImage(
      bitmap,
      (canvas.width - w) / 2,
      (canvas.height - h) / 2,
      w,
      h,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Falha ao preparar imagem.")),
        "image/jpeg",
        0.85,
      ),
    );
    return await uploadBlob(
      projectId,
      blob,
      canvas.width,
      canvas.height,
      kind,
      onProgress,
    );
  } finally {
    bitmap.close();
  }
}
