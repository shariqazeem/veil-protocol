/**
 * Notes Manager for GhostSats.
 *
 * Reads notes from encrypted/plaintext storage and checks their on-chain status
 * by querying the ShieldedPool contract's batch results.
 */

import type { GhostNote } from "./privacy";
import { loadNotes, loadNotesEncrypted } from "./privacy";
import { RpcProvider, Contract, type Abi } from "starknet";
import { SHIELDED_POOL_ABI } from "@/contracts/abi";
import addresses from "@/contracts/addresses.json";

/** Retry an async function with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error("Retry exhausted");
}

export type NoteStatus = "PENDING" | "READY" | "CLAIMED" | "STALE";

export interface NoteWithStatus extends GhostNote {
  status: NoteStatus;
  wbtcShare?: string;
  hasBtcIdentity?: boolean;
  batchTimestamp?: number;
  withdrawableAt?: number;
}

/** Check the on-chain status of a single note. */
export async function checkNoteStatus(
  note: GhostNote,
  provider?: RpcProvider,
): Promise<NoteWithStatus> {
  if (note.claimed) {
    return { ...note, status: "CLAIMED" };
  }

  const poolAddress = addresses.contracts.shieldedPool;
  if (!poolAddress) {
    return { ...note, status: "PENDING" };
  }

  try {
    const rpc =
      provider ??
      new RpcProvider({
        nodeUrl: "https://starknet-sepolia-rpc.publicnode.com",
      });

    const pool = new Contract({
      abi: SHIELDED_POOL_ABI as unknown as Abi,
      address: poolAddress,
      providerOrAccount: rpc,
    });

    // Verify commitment exists on-chain (with retry)
    const isValid = await withRetry(() => pool.call("is_commitment_valid", [note.commitment]));
    if (!isValid) {
      // Commitment not found on-chain — stale note from a previous deployment
      return { ...note, status: "STALE" };
    }

    const batch = await withRetry(() => pool.call("get_batch_result", [note.batchId]));

    const result = batch as Record<string, bigint | boolean>;
    const isFinalized = Boolean(result.is_finalized);

    if (!isFinalized) {
      return { ...note, status: "PENDING" };
    }

    const amount = BigInt(note.amount);
    const totalUsdcIn = BigInt(result.total_usdc_in?.toString() ?? "0");
    const totalWbtcOut = BigInt(result.total_wbtc_out?.toString() ?? "0");

    let wbtcShare = "0";
    if (totalUsdcIn > 0n) {
      wbtcShare = ((amount * totalWbtcOut) / totalUsdcIn).toString();
    }

    // Check if this deposit has a linked Bitcoin identity
    let hasBtcIdentity = false;
    try {
      const btcId = await withRetry(() => pool.call("get_btc_identity", [note.commitment]));
      hasBtcIdentity = btcId !== 0n && btcId !== "0x0" && btcId !== "0" && btcId != null;
    } catch {
      // Older contracts may not have this function
    }

    const batchTimestamp = Number(result.timestamp?.toString() ?? "0");
    const withdrawableAt = batchTimestamp + 60;

    return { ...note, status: "READY", wbtcShare, hasBtcIdentity, batchTimestamp, withdrawableAt };
  } catch {
    return { ...note, status: "PENDING" };
  }
}

/** Check status of all notes (supports encrypted storage). */
export async function checkAllNoteStatuses(
  walletAddress?: string,
  provider?: RpcProvider,
): Promise<NoteWithStatus[]> {
  const notes = walletAddress
    ? await loadNotesEncrypted(walletAddress)
    : loadNotes();
  const withStatuses = await Promise.all(notes.map((n) => checkNoteStatus(n, provider)));
  // Filter out stale notes whose commitments don't exist on-chain (e.g. from old contract deployments)
  return withStatuses.filter((n) => n.status !== "STALE");
}
