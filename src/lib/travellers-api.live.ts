import type { TravellerCard } from "@/lib/travellers";

export async function listShownTravellers(): Promise<TravellerCard[]> {
  return [];
}

export async function listInbox(): Promise<TravellerCard[]> {
  throw new Error("Archive review is on the studio host");
}

export async function publishTraveller(): Promise<{ id: string }> {
  throw new Error("Publish is on the studio host");
}

export async function getTravellerFile(): Promise<{
  image: string;
  mime: string;
  handle: string;
  title: string;
  note: string;
  createdAt: string;
}> {
  throw new Error("Not found");
}

export async function setTravellerStatus(): Promise<{ ok: true }> {
  throw new Error("Archive review is on the studio host");
}
