import { db } from "./db";
import {
  documentTemplates as documentTemplatesTable,
  documentTemplateVersions as documentTemplateVersionsTable,
  documents as documentsTable,
  documentVersions as documentVersionsTable,
  clientUploads as clientUploadsTable,
  ishares as isharesTable,
  caseBundles as caseBundlesTable,
} from "@shared/schema";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage";

async function main() {
  const objectStorageService = new ObjectStorageService();
  const privateDir = objectStorageService.getPrivateObjectDir();
  const pathParts = (privateDir.startsWith("/") ? privateDir.slice(1) : privateDir).split("/");
  const bucketName = pathParts[0];
  const basePrefix = pathParts.slice(1).join("/");
  const uploadsPrefix = `${basePrefix ? basePrefix + "/" : ""}uploads/`;

  console.log("Bucket:", bucketName);
  console.log("Uploads prefix:", uploadsPrefix);

  // 1. Gather every referenced fileUrl from the database, normalized to /objects/uploads/<id>
  const referenced = new Set<string>();
  const addUrl = (url: string | null | undefined) => {
    if (!url) return;
    referenced.add(url);
  };

  const [templates, templateVersions, docs, docVersions, clientUploads, ishares, bundles] = await Promise.all([
    db.select().from(documentTemplatesTable),
    db.select().from(documentTemplateVersionsTable),
    db.select().from(documentsTable),
    db.select().from(documentVersionsTable),
    db.select().from(clientUploadsTable),
    db.select().from(isharesTable),
    db.select().from(caseBundlesTable),
  ]);

  templates.forEach(t => addUrl(t.fileUrl));
  templateVersions.forEach(v => addUrl(v.fileUrl));
  docs.forEach(d => addUrl(d.fileUrl));
  docVersions.forEach(v => addUrl(v.fileUrl));
  clientUploads.forEach(c => addUrl(c.fileUrl));
  ishares.forEach(i => addUrl(i.fileUrl));
  bundles.forEach(b => addUrl((b as any).cachedFileUrl));

  console.log("Referenced file URLs found in DB:", referenced.size);

  // Normalize referenced URLs to bare object names within the bucket (relative to uploads/ prefix)
  const referencedObjectNames = new Set<string>();
  for (const url of referenced) {
    const normalized = objectStorageService.normalizeObjectEntityPath(url);
    if (normalized.startsWith("/objects/")) {
      const entityId = normalized.slice("/objects/".length);
      referencedObjectNames.add(`${basePrefix ? basePrefix + "/" : ""}${entityId}`);
    }
  }

  // 2. List every object in the bucket under uploads/
  const bucket = objectStorageClient.bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: uploadsPrefix });
  console.log("Total objects under uploads/:", files.length);

  const orphans = files.filter(f => !referencedObjectNames.has(f.name));
  console.log("Orphaned objects (not referenced by any DB row):", orphans.length);
  orphans.slice(0, 20).forEach(f => console.log("  ORPHAN:", f.name));

  const DRY_RUN = process.env.DRY_RUN !== "false";
  if (DRY_RUN) {
    console.log("\nDRY RUN — no files deleted. Set DRY_RUN=false to actually delete.");
    return;
  }

  let deleted = 0;
  for (const f of orphans) {
    try {
      await f.delete();
      deleted++;
    } catch (err) {
      console.error("Failed to delete", f.name, err);
    }
  }
  console.log("Deleted:", deleted);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
