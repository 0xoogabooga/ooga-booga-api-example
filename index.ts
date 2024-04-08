import {
	http,
	type Address,
	createPublicClient,
	createWalletClient,
	maxUint256,
	parseEther,
	publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { berachainTestnet } from "viem/chains";

if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required");

if (!process.env.PUBLIC_API_URL) throw new Error("PUBLIC_API_URL is required");

const PUBLIC_API_URL = process.env.PUBLIC_API_URL;
const NATIVE_TOKEN: `0x${string}` =
	"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const swapParams = {
	tokenIn: NATIVE_TOKEN,
	tokenOut: "0x6581e59a1c8da66ed0d313a0d4029dce2f746cc5" as Address,
	amount: parseEther("0.0001"),
	to: "0x2e50c47def5aa3fb5ff58cb561cbecff65ddb1e3" as Address,
	from: "0x2e50c47def5aa3fb5ff58cb561cbecff65ddb1e3" as Address,
	slippage: 0.1,
};

type SwapParams = typeof swapParams;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = createWalletClient({
	chain: berachainTestnet,
	transport: http(),
	account,
}).extend(publicActions);

const getAllowance = async (token: Address, from: Address) => {
	if (token === NATIVE_TOKEN) return maxUint256;

	const publicApiUrl = new URL(`${PUBLIC_API_URL}/approve/allowance`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);

	const res = await fetch(publicApiUrl);
	const json = await res.json();
	return json.allowance;
};

const approveAllowance = async (
	token: Address,
	from: Address,
	amount: bigint,
) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/approve`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);
	publicApiUrl.searchParams.set("amount", amount.toString());

	const res = await fetch(publicApiUrl);
	const { tx } = await res.json();

	console.log("Submitting approve...");
	const hash = await client.sendTransaction({
		from: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
		value: tx.value,
	});

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Approval complete", rcpt.transactionHash, rcpt.status);
};

const swap = async (swapParams: SwapParams) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/swap`);
	publicApiUrl.searchParams.set("tokenIn", swapParams.tokenIn);
	publicApiUrl.searchParams.set("from", swapParams.from);
	publicApiUrl.searchParams.set("amount", swapParams.amount.toString());
	publicApiUrl.searchParams.set("tokenOut", swapParams.tokenOut);
	publicApiUrl.searchParams.set("to", swapParams.to);
	publicApiUrl.searchParams.set("slippage", swapParams.slippage.toString());

	const res = await fetch(publicApiUrl);
	const { tx } = await res.json();
	console.log(tx);

	console.log("Submitting swap...");
	const hash = await client.sendTransaction({
		from: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
		value: tx.value as bigint,
	});

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Swap complete", rcpt.transactionHash, rcpt.status);
};

async function main() {
	// Check allowance
	const allowance = await getAllowance(swapParams.tokenIn, swapParams.from);
	console.log("Allowance", allowance);
	// Approve if necessary
	if (allowance < swapParams.amount) {
		await approveAllowance(
			swapParams.tokenIn,
			swapParams.from,
			swapParams.amount,
		);
	}
	// Swap
	await swap(swapParams);
}

main();
