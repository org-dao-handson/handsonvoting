#!/usr/bin/env ts-node
import { config } from "dotenv";
import { JsonRpcProvider, Wallet } from "ethers";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { Chain } from "@ethereumjs/common";
import {
    VocdoniApiService,
    VoteBallot,
    BallotProofOutput,
    CircomProof,
    Groth16Proof,
    ProofInputs as Groth16ProofInputs,
    BallotProof,
    BallotProofInputs
} from "../../../src/sequencer";
import { getElectionMetadataTemplate, BallotMode as ApiBallotMode } from "../../../src/core";
import {
    SmartContractService,
    ProcessRegistryService,
    OrganizationRegistryService,
    ProcessStatus,
    deployedAddresses as addresses
} from "../../../src/contracts";
import { Census, EncryptionKey } from "../../../src/core";
import { randomBytes } from "crypto";







config();

// ────────────────────────────────────────────────────────────
//   REQUIRED ENV VARS
// ────────────────────────────────────────────────────────────
const {
  API_URL,
  SEPOLIA_RPC,
  PRIVATE_KEY,
  PROCESS_REGISTRY_ADDRESS,
  ORGANIZATION_REGISTRY_ADDRESS,
  ORG_ID,
  CENSUS_CSV_PATH,
  ELECTION_DETAILS_PATH,
} = process.env;
for (const v of [
  "API_URL",
  "SEPOLIA_RPC",
  "PRIVATE_KEY",
  "PROCESS_REGISTRY_ADDRESS",
  "ORGANIZATION_REGISTRY_ADDRESS",
  "ORG_ID",
  "CENSUS_CSV_PATH",
]) {
  if (!process.env[v]) {
    throw new Error(`${v} environment variable is required`);
  }
}

// Output file defaults to ./electionDetails.json
const OUTPUT_PATH =
  ELECTION_DETAILS_PATH || resolve(__dirname, "electionDetails.json");

// Static questions definition
const QUESTIONS: Array<IQuestion> = [
  {
    title: { default: "What is your favorite color?" },
    description: { default: "Choose your preferred color from the options below" },
    meta: {},
    choices: [
      { title: { default: "Red" }, value: 0, meta: {} },
      { title: { default: "Blue" }, value: 1, meta: {} },
      { title: { default: "Green" }, value: 2, meta: {} },
      { title: { default: "Yellow" }, value: 3, meta: {} },
    ],
  },
  {
    title: { default: "What is your preferred transportation?" },
    description: { default: "Select your most used mode of transportation" },
    meta: {},
    choices: [
      { title: { default: "Car" }, value: 0, meta: {} },
      { title: { default: "Bike" }, value: 1, meta: {} },
      { title: { default: "Public Transport" }, value: 2, meta: {} },
      { title: { default: "Walking" }, value: 3, meta: {} },
    ],
  },
];

// Logging helpers
const info = (msg: string) => console.log(chalk.cyan("ℹ"), msg);
const success = (msg: string) => console.log(chalk.green("✔"), msg);
const step = (n: number, msg: string) =>
  console.log(chalk.yellow.bold(`\n[Step ${n}]`), chalk.white(msg));

// Initialize API & wallet
function initClients() {
  const provider = new JsonRpcProvider(SEPOLIA_RPC!);
  const wallet = new Wallet(PRIVATE_KEY!, provider);
  const api = new VocdoniApiService(API_URL!);
  return { api, provider, wallet };
}

// Load census from CSV: address,weight per line
function loadCensus(filePath: string): Array<{ key: string; weight: string }> {
  const csv = fs.readFileSync(filePath, "utf-8");
  return csv
    .split(/\r?\n/)   
    .filter(line => line.trim())
    .map(line => {
      const [key, weight] = line.split(",").map(s => s.trim());
      return { key, weight };
    });
}

async function run() {
  console.log(chalk.bold.cyan("\n🚀 Creating election process…\n"));

  const { api, provider, wallet } = initClients();
  const orgId = ORG_ID!;

  // Step 1: Ping HTTP API
  step(1, "Ping Vocdoni API");
  await api.ping();
  success("API reachable");

  // Step 2: Fetch circuit & on‐chain info
  step(2, "Fetch zk‐circuit & contract info");
  const infoResp: InfoResponse = await api.getInfo();
  success("Fetched info from API");

  // Step 3: Create Census
  step(3, "Create census on Vocdoni");
  const censusId = await api.createCensus();
  success(`Census created: ${censusId}`);

  // Step 4: Add participants from CSV
  step(4, "Load and add participants");
  const participants = loadCensus(CENSUS_CSV_PATH!);
  await api.addParticipants(censusId, participants);
  success(`Added ${participants.length} participants`);

  // Step 5: Verify participants
  step(5, "Verify participants stored");
  const stored = await api.getParticipants(censusId);
  console.log(
    `   Participants: ${stored.map(p => `${p.key}(${p.weight})`).join(", ")}`
  );

  // Step 6: Fetch census root & size
  step(6, "Fetch census root & size");
  const censusRoot = await api.getCensusRoot(censusId);
  const censusSize = await api.getCensusSize(censusId);
  success(`Census ready (root=${censusRoot}, size=${censusSize})`);

  // Step 7: Push election metadata (questions)
  step(7, "Push election metadata");
  const metadata = { title: { default: "Election" }, description: { default: "Election created via script" }, questions: QUESTIONS };
  const hash = await api.pushMetadata(metadata);
  const metadataUrl = api.getMetadataUrl(hash);
  success(`Metadata pushed: ${metadataUrl}`);

  // Step 8: Create process on Sequencer
  step(8, "Create process via Sequencer API");
  const chainId = Chain.Sepolia;
  const nonce = await provider.getTransactionCount(wallet.address);
  const signature = await wallet.signMessage(`${chainId}${nonce}`);
  const { processId, encryptionPubKey, stateRoot } = await api.createProcess({
    censusRoot,
    ballotMode: { maxCount: QUESTIONS.length, maxValue: "3", minValue: "0", forceUniqueness: false, costFromWeight: false, costExponent: 0, maxTotalCost: "6", minTotalCost: "0" },
    nonce,
    chainId,
    signature,
  });
  success(`Process created: ${processId}`);

  // Step 9: Verify admin rights
  step(9, "Verify admin on‐chain");
  const orgSvc = new OrganizationRegistryService(ORGANIZATION_REGISTRY_ADDRESS!, wallet);
  const isAdmin = await orgSvc.isAdministrator(orgId, wallet.address);
  if (!isAdmin) throw new Error("Caller is not an organization admin");
  success("Admin rights confirmed");

  // Step 10: Submit newProcess on‐chain
  step(10, "Submit new process to ProcessRegistry");
  const procSvc = new ProcessRegistryService(PROCESS_REGISTRY_ADDRESS!, wallet);
  await SmartContractService.executeTx(
    procSvc.newProcess(
      ProcessStatus.READY,
      Math.floor(Date.now() / 1000) + 60,
      3600 * 8,
      { maxCount: QUESTIONS.length, maxValue: "3", minValue: "0", forceUniqueness: false, costFromWeight: false, costExponent: 0, maxTotalCost: "6", minTotalCost: "0" },
      { censusOrigin: 1, maxVotes: censusSize.toString(), censusRoot, censusURI: `${API_URL!}/censuses/${censusRoot}` } as Census,
      metadataUrl,
      orgId,
      processId,
      { x: encryptionPubKey[0], y: encryptionPubKey[1] } as EncryptionKey,
      BigInt(stateRoot)
    )
  );
  success("Process submitted on‐chain");

  // Step 11: Save election details to file for front-end
  step(11, "Save election details to file");
  const details = {
    processId,
    encryptionPubKey,
    censusRoot,
    metadataUrl,
    censusId,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(details, null, 2));
  success(`Election details saved to ${OUTPUT_PATH}`);

  console.log(chalk.bold.green("\n✅ Done. You can now use these details in your voting UI.\n"));
  process.exit(0);
}

run().catch(err => {
  console.error(chalk.red("❌ Fatal error:"), err);
  process.exit(1);
});
