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
  ESCROW_V2_CONTRACT_ADDRESS,
  ESCROW_REFUND_ABI,
  ESCROW_V2_REFUND_FCFS_ABI,
  basescanTxUrl,
  uuidToBytes32,
} from "@/lib/escrow";
import { formatUsdc } from "@/lib/payments";
import { refundEscrowAction } from "@/app/applications/actions";
import {
  DEFAULT_LOCALE,
  createTranslator,
  type Locale,
} from "@/lib/i18n";

type Phase =
  | "idle"
  | "connecting"
  | "refunding"
  | "recording"
  | "done"
  | "error";

function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  return eth ?? null;
}

export function EscrowRefundPanel({
  taskId,
  rewardAmount,
  contractAddress = ESCROW_CONTRACT_ADDRESS,
  locale = DEFAULT_LOCALE,
}: {
  taskId: string;
  rewardAmount: number | null;
  contractAddress?: string;
  locale?: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  const busy = phase === "connecting" || phase === "refunding" || phase === "recording";

  async function handleRefund() {
    setError("");

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

      setPhase("refunding");
      const isV2 = contractAddress.toLowerCase() === ESCROW_V2_CONTRACT_ADDRESS.toLowerCase();
      const hash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: isV2 ? ESCROW_V2_REFUND_FCFS_ABI : ESCROW_REFUND_ABI,
        functionName: isV2 ? "refundFCFSEscrow" : "refundEscrow",
        args: [taskKey],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error(t("escrow.refund.reverted"));
      }
      setTxHash(hash);

      setPhase("recording");
      const result = await refundEscrowAction(taskId, hash);
      if (!result.ok) throw new Error(result.message);

      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("error");
      const message =
        err instanceof Error ? err.message : t("escrow.refund.failed");
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
              {t("escrow.refund.doneTitle")}
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
              {t("escrow.refund.doneBody", {
                amount: formatUsdc(rewardAmount ?? 0),
              })}
            </p>
            {txHash ? (
              <a
                href={basescanTxUrl(txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 break-all rounded-lg border-2 border-[#140625] bg-white px-3 py-2 text-xs font-black text-[#7c3cff] shadow-[2px_2px_0_#140625] transition hover:bg-[#38e7ff]"
              >
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                {t("escrow.refund.viewTx")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[#140625] bg-[#ffe1ed] p-4 shadow-[3px_3px_0_#140625]">
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#c42463]" />
        <div className="flex-1">
          <h3 className="font-black text-[#140625]">
            {t("escrow.refund.title")}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#3c214b]">
            {t("escrow.refund.body", {
              amount: formatUsdc(rewardAmount ?? 0),
            })}
          </p>

          {phase === "error" && error ? (
            <div className="mt-3 flex gap-2 rounded-lg border-2 border-[#140625] bg-white p-3 text-sm font-bold text-[#8a1742]">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRefund}
            disabled={busy}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border-2 border-[#140625] bg-[#c42463] px-4 py-2 text-xs font-black uppercase text-white shadow-[3px_3px_0_#140625] transition hover:-translate-y-0.5 hover:bg-[#8a1742] disabled:cursor-not-allowed disabled:bg-[#c9c0d3] disabled:text-[#5a3b66]"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                {phase === "connecting"
                  ? t("escrow.refund.connecting")
                  : phase === "refunding"
                    ? t("escrow.refund.refunding")
                    : t("escrow.refund.recording")}
              </>
            ) : (
              <>
                <Wallet aria-hidden="true" className="h-4 w-4" />
                {t("escrow.refund.button")}
              </>
            )}
          </button>
          <p className="mt-2 text-xs font-bold text-[#5a3b66]">
            {t("escrow.refund.prompts")}
          </p>
        </div>
      </div>
    </div>
  );
}
