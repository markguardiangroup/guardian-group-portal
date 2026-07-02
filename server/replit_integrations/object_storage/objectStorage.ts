import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Payload too large");
    this.name = "PayloadTooLargeError";
    Object.setPrototypeOf(this, PayloadTooLargeError.prototype);
  }
}

/**
 * Streams a raw request body directly into GCS instead of buffering it in process
 * memory. The previous approach (Buffer.concat over every chunk) meant a single
 * in-flight upload held its entire declared size in RAM, and multiple concurrent
 * uploads from one account could exhaust server memory before the size cap ever
 * rejected anything. This enforces `maxBytes` as bytes arrive, aborting the GCS
 * write and deleting the partial object as soon as the ceiling is crossed, so
 * memory usage per request stays bounded to the streaming buffer size rather than
 * the full file size.
 */
export async function streamRequestToObjectStorage(
  req: AsyncIterable<Buffer | string>,
  file: File,
  maxBytes: number,
  saveOptions: { contentType?: string; metadata?: Record<string, string> } = {}
): Promise<number> {
  const writeStream = file.createWriteStream({
    contentType: saveOptions.contentType,
    metadata: saveOptions.metadata,
    resumable: false,
  });

  let total = 0;
  let aborted = false;

  try {
    await new Promise<void>((resolve, reject) => {
      writeStream.once("error", (err) => {
        if (aborted) return; // we already rejected with PayloadTooLargeError
        reject(err);
      });
      writeStream.once("finish", resolve);

      (async () => {
        try {
          for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += buf.length;
            if (total > maxBytes) {
              aborted = true;
              writeStream.destroy(new Error("Payload too large"));
              reject(new PayloadTooLargeError());
              return;
            }
            if (!writeStream.write(buf)) {
              await new Promise<void>((r) => writeStream.once("drain", r));
            }
          }
          writeStream.end();
        } catch (err) {
          aborted = true;
          writeStream.destroy(err instanceof Error ? err : new Error(String(err)));
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    });
  } catch (err) {
    // Clean up whatever partial/oversized object made it to GCS before failing.
    await file.delete().catch(() => {});
    throw err;
  }

  return total;
}

// MIME types that are safe to render with Content-Disposition: inline in a browser
// (i.e. cannot execute script or otherwise act as active content on our origin).
// Anything else is forced to download so an uploaded HTML/SVG/XML file can never be
// rendered as a page on the application's own origin.
const INLINE_SAFE_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600, downloadFilename?: string) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      
      // Build headers. Only a small allowlist of MIME types is ever allowed to render
      // inline in the browser — everything else is forced to download so an uploaded
      // HTML/SVG/script-bearing file can never execute as a page on our origin.
      const contentType = metadata.contentType || "application/octet-stream";
      const canRenderInline = INLINE_SAFE_CONTENT_TYPES.has(contentType.toLowerCase());
      const headers: Record<string, string | number> = {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      };
      
      if (metadata.size) {
        headers["Content-Length"] = metadata.size;
      }
      
      // Add Content-Disposition. Force "attachment" for any type that isn't known-safe
      // to render inline, regardless of whether a download filename was requested.
      if (downloadFilename) {
        const safeName = downloadFilename.replace(/[^\w\s.-]/g, '_');
        headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
      } else if (!canRenderInline) {
        headers["Content-Disposition"] = "attachment";
      }
      
      // Set appropriate headers
      res.set(headers);

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Saves a DOCX-preview PDF buffer to private storage and returns the normalized /objects/ path.
  async saveDocxPreview(buffer: Buffer, cacheKey: string): Promise<string> {
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/docx-previews/${cacheKey}.pdf`;
    const pathParts = (fullPath.startsWith("/") ? fullPath.slice(1) : fullPath).split("/");
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType: "application/pdf" });
    return `/objects/docx-previews/${cacheKey}.pdf`;
  }

  // Saves a buffer to private storage and returns the normalized /objects/ path.
  async saveBundle(buffer: Buffer, bundleId: string): Promise<string> {
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/bundles/${bundleId}.pdf`;
    const pathParts = (fullPath.startsWith("/") ? fullPath.slice(1) : fullPath).split("/");
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType: "application/pdf" });
    return `/objects/bundles/${bundleId}.pdf`;
  }

  // Deletes an object entity from storage by its normalized path.
  async deleteObjectEntityFile(objectPath: string): Promise<void> {
    try {
      const objectFile = await this.getObjectEntityFile(objectPath);
      await objectFile.delete();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return;
      }
      throw error;
    }
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

