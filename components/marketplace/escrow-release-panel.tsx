"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type EIP1193Provider,
} from "viem";
import { base } from "viem/chains";
import {
  ESCROW_CONTRACT_ADDRESS,
  ESCROW_ASSIGN_RAFFLE_ABI,
  ESCROW_ASSIGN_ABI,
  ESCROW_RELEASE_RAFFLE_ABI,
  ESCROW_RELEASE_ABI,
  basescanTxUrl,
  usdcToUnits,
  uuidToBytes32,
} from "@/lib/escrow";
import { formatUsdc } from "@/lib/payments";
import {
  releaseEscrowAction,
  releaseRaffleEscrowAction,
} from "@/app/applications/actions";
import {
  DEFAULT_LOCALE,
  createTranslator,
  type Locale,
} from "@/lib/i18n";

type Phase =
  | "idle"
  | "connecting"
  | "assigning"
  | "releasing"
  | "recording"
  | "done"
  | "error";

function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  return eth ?? null;
}

export function EscrowReleasePanel({
  submissionId,
  taskId,
  rewardAmount,
  workerWalletAddress,
  contractAddress = ESCROW_CONTRACT_ADDRESS,
  locale = DEFAULT_LOCALE,
}: {
  submissionId: string;
  taskId: string;
  rewardAmount: number | null;
  workerWalletAddress: string | null;
  contractAddress?: string;
  locale?: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [assignTxHash, setAssignTxHash] = useState<string>("");
  const [releaseTxHash, setReleaseTxHash] = useState<string>("");

  const busy =
    phase === "connecting" ||
    phase === "assigning" ||
    phase === "releasing" ||
    phase === "recording";

  async function handleRelease() {
    setError("");

    if (!workerWalletAddress) {
      setPhase("error");
      setError(t("escrow.release.noWorkerWallet"));
      return;
    }

    const provider = getProvider();
    if (!provider) {
      setPhase("error");
      setError(t("payment.walletNoWallet"));
      return;
    }

    try {
      setPhase("connecting");
      const [account] = (await provider.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      if (!account) throw new Error(t("payment.walletNoAccount"));

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      // Ensure wallet is on Base mainnet
      const currentChain = await walletClient.getChainId();
      if (currentChain !== base.id) {
        await walletClient.switchChain({ id: base.id });
      }

      const taskKey = uuidToBytes32(taskId);

      // Step 1: Assign worker
      setPhase("assigning");
      const assignHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ESCROW_ASSIGN_ABI,
        functionName: "assignWorker",
        args: [taskKey, workerWalletAddress as `0x${string}`],
      });

      const assignReceipt = await publicClient.waitForTransactionReceipt({
        hash: assignHash,
      });
      if (assignReceipt.status !== "success") {
        throw new Error(t("escrow.release.assignReverted"));
      }
      setAssignTxHash(assignHash);

      // Step 2: Release escrow
      setPhase("releasing");
      const releaseHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ESCROW_RELEASE_ABI,
        functionName: "releaseEscrow",
        args: [taskKey],
      });

      const releaseReceipt = await publicClient.waitForTransactionReceipt({
        hash: releaseHash,
      });
      if (releaseReceipt.status !== "success") {
        throw new Error(t("escrow.release.releaseReverted"));
      }
      setReleaseTxHash(releaseHash);

      // Step 3: Record both on the submission
      setPhase("recording");
      const result = await releaseEscrowAction(
        submissionId,
        assignHash,
        releaseHash,
      );
      if (!result.ok) throw new Error(result.message);

      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("error");
      const message =
        err instanceof Error ? err.message : t("escrow.release.failed");
      setError(message.split("\n")[0].slice(0, 200));
    }
  }

  if (phase === "done") {
    return (
      <div className="mt-4 rounded-lg border-2 border-[#140625] bg-[#dff7e6] p-4 shadow-[3px_3px_0_#140625]">
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 text-[#1f6b3a]"
          />
          <div>
            <h3 className="font-black text-[#140625]">
              {t("escrow.release.doneTitle")}
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
              {t("escrow.release.doneBody", {
                amount: formatUsdc(rewardAmount ?? 0),
              })}
            </p>
            <div className="mt-3 space-y-2">
              {assignTxHash ? (
                <a
                  href={basescanTxUrl(assignTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 break-all rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black text-[#7c3cff] shadow-[2px_2px_0_#140625] transition hover:bg-[#38e7ff]"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("escrow.release.viewAssignTx")}
                </a>
              ) : null}
              {releaseTxHash ? (
                <a
                  href={basescanTxUrl(releaseTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="block inline-flex items-center gap-2 break-all rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black text-[#7c3cff] shadow-[2px_2px_0_#140625] transition hover:bg-[#38e7ff]"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("escrow.release.viewReleaseTx")}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-[#140625] bg-[#f2e6ff] p-4 shadow-[3px_3px_0_#140625]">
      <div className="flex items-start gap-3">
        <Wallet aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7c3cff]" />
        <div className="flex-1">
          <h3 className="font-black text-[#140625]">
            {t("escrow.release.title")}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
            {t("escrow.release.body", {
              amount: formatUsdc(rewardAmount ?? 0),
            })}{" "}
            <span className="break-all font-mono text-xs">
              {workerWalletAddress}
            </span>
          </p>

          {phase === "error" && error ? (
            <div className="mt-3 flex gap-2 rounded-lg border-2 border-[#140625] bg-[#ffe1ed] p-3 text-sm font-bold text-[#8a1742]">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRelease}
            disabled={busy}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-[#140625] bg-[#23b26d] px-4 py-2 text-xs font-black uppercase text-white shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#1f6b3a] disabled:cursor-not-allowed disabled:bg-[#c9c0d3] disabled:text-[#5a3b66]"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                {phase === "connecting"
                  ? t("escrow.release.connecting")
                  : phase === "assigning"
                    ? t("escrow.release.assigning")
                    : phase === "releasing"
                      ? t("escrow.release.releasing")
                      : t("escrow.fund.recording")}
              </>
            ) : (
              <>
                <Wallet aria-hidden="true" className="h-4 w-4" />
                {t("escrow.release.button")}
              </>
            )}
          </button>
          <p className="mt-2 text-xs font-bold text-[#5a3b66]">
            {t("escrow.release.prompts")}
          </p>
        </div>
      </div>
    </div>
  );
}

type RaffleEscrowWinner = {
  submissionId: string;
  walletAddress: string | null;
  grossAmount: number;
  label: string;
};

export function EscrowRaffleReleasePanel({
  taskId,
  winners,
  contractAddress = ESCROW_CONTRACT_ADDRESS,
  locale = DEFAULT_LOCALE,
}: {
  taskId: string;
  winners: RaffleEscrowWinner[];
  contractAddress?: string;
  locale?: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [assignTxHash, setAssignTxHash] = useState<string>("");
  const [releaseTxHash, setReleaseTxHash] = useState<string>("");

  const busy =
    phase === "connecting" ||
    phase === "assigning" ||
    phase === "releasing" ||
    phase === "recording";

  const missingWallet = winners.find((winner) => !winner.walletAddress);
  const totalGross = winners.reduce(
    (sum, winner) => sum + winner.grossAmount,
    0,
  );

  async function handleRelease() {
    setError("");

    if (winners.length === 0) {
      setPhase("error");
      setError(t("escrow.release.noRaffleWinners"));
      return;
    }
    if (missingWallet) {
      setPhase("error");
      setError(t("escrow.release.raffleMissingWallet"));
      return;
    }

    const provider = getProvider();
    if (!provider) {
      setPhase("error");
      setError(t("payment.walletNoWallet"));
      return;
    }

    try {
      setPhase("connecting");
      const [account] = (await provider.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      if (!account) throw new Error(t("payment.walletNoAccount"));

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const currentChain = await walletClient.getChainId();
      if (currentChain !== base.id) {
        await walletClient.switchChain({ id: base.id });
      }

      const taskKey = uuidToBytes32(taskId);
      const winnerAddresses = winners.map(
        (winner) => winner.walletAddress as `0x${string}`,
      );
      const grossAmounts = winners.map((winner) =>
        usdcToUnits(winner.grossAmount),
      );

      setPhase("assigning");
      const assignHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ESCROW_ASSIGN_RAFFLE_ABI,
        functionName: "assignRaffleWinners",
        args: [taskKey, winnerAddresses, grossAmounts],
      });

      const assignReceipt = await publicClient.waitForTransactionReceipt({
        hash: assignHash,
      });
      if (assignReceipt.status !== "success") {
        throw new Error(t("escrow.release.assignReverted"));
      }
      setAssignTxHash(assignHash);

      setPhase("releasing");
      const releaseHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: ESCROW_RELEASE_RAFFLE_ABI,
        functionName: "releaseRaffleEscrow",
        args: [taskKey],
      });

      const releaseReceipt = await publicClient.waitForTransactionReceipt({
        hash: releaseHash,
      });
      if (releaseReceipt.status !== "success") {
        throw new Error(t("escrow.release.releaseReverted"));
      }
      setReleaseTxHash(releaseHash);

      setPhase("recording");
      const result = await releaseRaffleEscrowAction(
        taskId,
        assignHash,
        releaseHash,
      );
      if (!result.ok) throw new Error(result.message);

      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("error");
      const message =
        err instanceof Error ? err.message : t("escrow.release.failed");
      setError(message.split("\n")[0].slice(0, 200));
    }
  }

  if (phase === "done") {
    return (
      <div className="mt-4 rounded-lg border-2 border-[#140625] bg-[#dff7e6] p-4 shadow-[3px_3px_0_#140625]">
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 text-[#1f6b3a]"
          />
          <div>
            <h3 className="font-black text-[#140625]">
              {t("escrow.release.raffleDoneTitle")}
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
              {t("escrow.release.raffleDoneBody", {
                amount: formatUsdc(totalGross),
              })}
            </p>
            <div className="mt-3 space-y-2">
              {assignTxHash ? (
                <a
                  href={basescanTxUrl(assignTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 break-all rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black text-[#7c3cff] shadow-[2px_2px_0_#140625] transition hover:bg-[#38e7ff]"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("escrow.release.viewAssignTx")}
                </a>
              ) : null}
              {releaseTxHash ? (
                <a
                  href={basescanTxUrl(releaseTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="block inline-flex items-center gap-2 break-all rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black text-[#7c3cff] shadow-[2px_2px_0_#140625] transition hover:bg-[#38e7ff]"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  {t("escrow.release.viewReleaseTx")}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-[#140625] bg-[#f2e6ff] p-4 shadow-[3px_3px_0_#140625]">
      <div className="flex items-start gap-3">
        <Wallet aria-hidden="true" className="mt-0.5 h-5 w-5 text-[#7c3cff]" />
        <div className="flex-1">
          <h3 className="font-black text-[#140625]">
            {t("escrow.release.raffleTitle")}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
            {t("escrow.release.raffleBody", {
              amount: formatUsdc(totalGross),
              count: winners.length,
            })}
          </p>
          <div className="mt-3 grid gap-2">
            {winners.map((winner) => (
              <div
                key={winner.submissionId}
                className="rounded-lg border-2 border-[#140625] bg-white p-2 text-xs font-bold text-[#3c214b]"
              >
                <p className="font-black text-[#140625]">{winner.label}</p>
                <p className="break-all font-mono">
                  {winner.walletAddress ?? t("escrow.release.noWorkerWallet")}
                </p>
              </div>
            ))}
          </div>

          {phase === "error" && error ? (
            <div className="mt-3 flex gap-2 rounded-lg border-2 border-[#140625] bg-[#ffe1ed] p-3 text-sm font-bold text-[#8a1742]">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRelease}
            disabled={busy || Boolean(missingWallet)}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-[#140625] bg-[#23b26d] px-4 py-2 text-xs font-black uppercase text-white shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#1f6b3a] disabled:cursor-not-allowed disabled:bg-[#c9c0d3] disabled:text-[#5a3b66]"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                {phase === "connecting"
                  ? t("escrow.release.connecting")
                  : phase === "assigning"
                    ? t("escrow.release.assigning")
                    : phase === "releasing"
                      ? t("escrow.release.releasing")
                      : t("escrow.fund.recording")}
              </>
            ) : (
              <>
                <Wallet aria-hidden="true" className="h-4 w-4" />
                {t("escrow.release.raffleButton")}
              </>
            )}
          </button>
          <p className="mt-2 text-xs font-bold text-[#5a3b66]">
            {t("escrow.release.rafflePrompts")}
          </p>
        </div>
      </div>
    </div>
  );
}
