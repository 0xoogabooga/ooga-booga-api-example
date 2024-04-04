import { createPublicClient, http } from "viem";
import { berachainTestnet } from "viem/chains";

console.log("Hello via Bun!");

const client = createPublicClient({
  chain: berachainTestnet,
  transport: http(),
});
