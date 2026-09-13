import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { TravellerCard, TravellerStatus } from "@/lib/travellers";

const MIME = ["image/png", "image/jpeg", "image/webp"] as const;

function archiveKey() {
  const env = typeof process !== "undefined" ? process.env.ARCHIVE_KEY : undefined;
  return env && env.trim() ? env.trim() : "jestr-archive";
}

function assertKey(key: string) {
  if (key !== archiveKey()) throw new Error("Wrong archive key");
}

function asCard(row: Record<string, unknown>): TravellerCard {
  return {
    id: String(row.id),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    handle: String(row.handle),
    title: String(row.title),
    note: String(row.note ?? ""),
    mime: String(row.mime),
    thumb: String(row.thumb),
    status: row.status as TravellerStatus,
  };
}

export const listShownTravellers = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, created_at, handle, title, note, mime, thumb, status from travellers where status = 'shown' order by created_at desc limit 80`,
  );
  return rows.map(asCard);
});

export const publishTraveller = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string().min(1).max(80),
      handle: z.string().trim().min(1).max(48),
      title: z.string().trim().min(1).max(80),
      note: z.string().trim().max(400),
      consent: z.literal(true),
      mime: z.enum(MIME),
      image: z.string().min(32).max(9_000_000),
      thumb: z.string().min(32).max(1_200_000),
    }),
  )
  .handler(async ({ data }) => {
    assertKey(data.key);
    if (!data.image.startsWith("data:image/")) throw new Error("Need an image");
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql.query(
      `insert into travellers (id, handle, title, note, consent, mime, image, thumb, status)
       values ($1,$2,$3,$4,true,$5,$6,$7,'shown')`,
      [id, data.handle, data.title, data.note, data.mime, data.image, data.thumb],
    );
    return { id };
  });

export const listInbox = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().min(1).max(80) }))
  .handler(async ({ data }) => {
    assertKey(data.key);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select id, created_at, handle, title, note, mime, thumb, status from travellers order by created_at desc limit 200`,
    );
    return rows.map(asCard);
  });

export const getTravellerFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(8).max(80),
      key: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      image: string;
      mime: string;
      status: string;
      handle: string;
      title: string;
      note: string;
      created_at: string;
    }>(`select image, mime, status, handle, title, note, created_at from travellers where id = $1`, [data.id]);
    const row = rows[0];
    if (!row) throw new Error("Not found");
    if (row.status !== "shown") {
      if (!data.key) throw new Error("Wrong archive key");
      assertKey(data.key);
    }
    return {
      image: row.image,
      mime: row.mime,
      handle: row.handle,
      title: row.title,
      note: row.note,
      createdAt: String(row.created_at),
    };
  });

export const setTravellerStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string().min(1).max(80),
      id: z.string().min(8).max(80),
      status: z.enum(["pending", "shown", "held"]),
    }),
  )
  .handler(async ({ data }) => {
    assertKey(data.key);
    const sql = await getSql();
    await sql.query(`update travellers set status = $1 where id = $2`, [data.status, data.id]);
    return { ok: true };
  });
