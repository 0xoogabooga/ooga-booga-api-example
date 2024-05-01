import {
	http,
	type Address,
	createWalletClient,
	maxUint256,
	parseEther,
	publicActions,
} from "viem"; // Main library used to interface with the blockchain
import { privateKeyToAccount } from "viem/accounts";
import { berachainTestnet } from "viem/chains";

// Ensure that no required environment variables are missing
if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required");
if (!process.env.PUBLIC_API_URL) throw new Error("PUBLIC_API_URL is required");
if (!process.env.API_KEY) throw new Error("API_KEY is required");

// Ensure no sensitive information is hardcoded
const PRIVATE_KEY = process.env.PRIVATE_KEY as Address;
const PUBLIC_API_URL = process.env.PUBLIC_API_URL;
const API_KEY = process.env.API_KEY;

const account = privateKeyToAccount(PRIVATE_KEY);
const client = createWalletClient({
	chain: berachainTestnet,
	transport: http(),
	account,
}).extend(publicActions);

const NATIVE_TOKEN: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // Default address for Bera native token
const HONEY: Address = "0x7EeCA4205fF31f947EdBd49195a7A88E6A91161B"; // 

const swapParams = {
	tokenIn: NATIVE_TOKEN, // Address of the token swapping from (BERA)
	tokenOut: HONEY, // Address of the token swapping to (HONEY)
	amount: parseEther("0.01"), // Amount of tokenIn to swap
	from: account.address, // Address to send tokenIn from
	to: account.address, // Address to send tokenOut to (optional and defaults to `from`)
	slippage: 0.01, // Range from 0 to 1 to allow for price slippage
};
type SwapParams = typeof swapParams;

const headers = {
	Authorization: `Bearer ${API_KEY}`,
};

const getAllowance = async (token: Address, from: Address) => {
	// Native token does not require approvals for allowance
	if (token === NATIVE_TOKEN) return maxUint256;

	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve/allowance`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);

	const res = await fetch(publicApiUrl, {
		headers,
	});
	const json = await res.json();
	return json.allowance;
};

const approveAllowance = async (
	token: Address,
	from: Address,
	amount: bigint,
) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/approve`);
	publicApiUrl.searchParams.set("token", token);
	publicApiUrl.searchParams.set("from", from);
	publicApiUrl.searchParams.set("amount", amount.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting approve...");
	const hash = await client.sendTransaction({
		account: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
	});

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Approval complete", rcpt.transactionHash, rcpt.status);
};

const swap = async (swapParams: SwapParams) => {
	const publicApiUrl = new URL(`${PUBLIC_API_URL}/v1/swap`);
	publicApiUrl.searchParams.set("tokenIn", swapParams.tokenIn);
	publicApiUrl.searchParams.set("from", swapParams.from);
	publicApiUrl.searchParams.set("amount", swapParams.amount.toString());
	publicApiUrl.searchParams.set("tokenOut", swapParams.tokenOut);
	publicApiUrl.searchParams.set("to", swapParams.to);
	publicApiUrl.searchParams.set("slippage", swapParams.slippage.toString());

	const res = await fetch(publicApiUrl, { headers });
	const { tx } = await res.json();

	console.log("Submitting swap...");
	const hash = await client.sendTransaction({
		account: tx.from as Address,
		to: tx.to as Address,
		data: tx.data as `0x${string}`,
		value: tx.value ? BigInt(tx.value) : 0n,
	});
	console.log("hash", hash);

	const rcpt = await client.waitForTransactionReceipt({
		hash,
	});
	console.log("Swap complete", rcpt.status);
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
			swapParams.amount - allowance, // Only approve amount remaining
		);
	}
	// Swap
	await swap(swapParams);
}

main();
