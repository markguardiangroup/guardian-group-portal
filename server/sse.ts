import type { Response } from "express";
import type { UserRole } from "@shared/schema";

interface SseClient {
  userId: string;
  role: UserRole;
  companyId: string | null;
  res: Response;
}

const registry = new Map<string, Set<SseClient>>();

export function addClient(client: SseClient): void {
  if (!registry.has(client.userId)) {
    registry.set(client.userId, new Set());
  }
  registry.get(client.userId)!.add(client);
}

export function removeClient(client: SseClient): void {
  const set = registry.get(client.userId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) registry.delete(client.userId);
}

function writeEvent(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // client disconnected
  }
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  const set = registry.get(userId);
  if (!set) return;
  for (const client of set) {
    writeEvent(client.res, event, data);
  }
}

export function emitToRole(role: UserRole, event: string, data: unknown): void {
  for (const [, set] of registry) {
    for (const client of set) {
      if (client.role === role) writeEvent(client.res, event, data);
      // administrator users receive all events intended for developer
      else if (role === "developer" && client.role === "administrator") writeEvent(client.res, event, data);
    }
  }
}

export function emitToCompany(companyId: string, event: string, data: unknown): void {
  for (const [, set] of registry) {
    for (const client of set) {
      if (client.companyId === companyId) writeEvent(client.res, event, data);
    }
  }
}

export function emitToAll(event: string, data: unknown): void {
  for (const [, set] of registry) {
    for (const client of set) {
      writeEvent(client.res, event, data);
    }
  }
}

export function getOnlineUserIds(): string[] {
  return Array.from(registry.keys());
}
