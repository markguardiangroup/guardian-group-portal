import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "./objectAcl";
import { randomUUID } from "crypto";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
type ObjectAccessUser = {
  id?: string;
  role: string;
  companyId: string | null;
  consultantTier?: string | null;
  sources?: string[] | null;
};

export function registerObjectStorageRoutes(
  app: Express,
  options?: {
    /**
     * Business-level authorization check for a raw object path (e.g. "/objects/uploads/abc").
     * When provided, this is the source of truth for whether the requesting user may read the
     * object — it resolves the path back to its owning document/template/folder/case and re-runs
     * that entity's real access rule. When omitted, the route falls back to requiring only a
     * valid session (should only happen in environments that don't wire up business ACL checks).
     */
    checkObjectAccess?: (objectPath: string, user: ObjectAccessUser) => Promise<boolean>;
    /** Resolves the authenticated user for a session id, used to build the ObjectAccessUser. */
    getUserForSession?: (sessionUserId: string) => Promise<ObjectAccessUser | undefined>;
  }
): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Server-side file upload endpoint.
   * Accepts file as raw body and uploads to object storage.
   */
  app.post("/api/uploads/file", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const rawFileName = req.headers["x-file-name"] as string;
      const contentType = req.headers["content-type"] || "application/octet-stream";
      
      if (!rawFileName) {
        return res.status(400).json({ error: "Missing x-file-name header" });
      }
      
      // Decode the filename (client encodes it for safe header transmission)
      const fileName = decodeURIComponent(rawFileName);

      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      
      // Parse bucket and object name from path
      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      // Collect request body chunks
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Upload to GCS
      await file.save(buffer, {
        contentType: contentType,
        metadata: {
          originalName: fileName,
        },
      });
      
      const objectPath = `/objects/uploads/${objectId}`;
      
      res.json({
        objectPath,
        fileName,
        fileSize: buffer.length,
        mimeType: contentType,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * Query parameters:
   * - download: optional filename for Content-Disposition header (triggers download)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const sessionUserId = (req.session as any)?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      // Primary authorization: resolve the object path back to the business entity that
      // owns it (document, document version, template, client upload, iShare, case bundle)
      // and re-run that entity's real access rule. This is the only check that actually
      // enforces tenant/site/role scoping for this route.
      if (options?.checkObjectAccess && options?.getUserForSession) {
        const user = await options.getUserForSession(sessionUserId);
        if (!user) {
          return res.status(401).json({ error: "Authentication required" });
        }
        const canAccess = await options.checkObjectAccess(req.path, user);
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        // No business ACL resolver was wired up by the caller. Fall back to the object's own
        // ACL policy metadata (set via trySetObjectEntityAclPolicy) as a hard requirement —
        // without a resolver we cannot re-check business rules, so an object with no policy
        // is denied rather than allowed.
        const existingAclPolicy = await getObjectAclPolicy(objectFile);
        if (!existingAclPolicy) {
          return res.status(403).json({ error: "Access denied" });
        }
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId: sessionUserId,
          objectFile,
          requestedPermission: ObjectPermission.READ,
        });
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const downloadFilename = req.query.download as string | undefined;
      await objectStorageService.downloadObject(objectFile, res, 3600, downloadFilename);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

