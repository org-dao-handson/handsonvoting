'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  VocdoniApiService,
  BallotProof,
  CircomProof,
  VoteRequest,
  BallotProofInputs,
  InfoResponse,
  type IQuestion,
  type MultiLanguage,
} from '@vocdoni/davinci-sdk';
import { BrowserProvider } from 'ethers';

interface ElectionDetails {
  processId: string;
  encryptionPubKey: [string, string];
  censusRoot: string;
  metadataUrl: string;
  censusId: string;
}

interface Question extends IQuestion {
  title: MultiLanguage<string>;
  description: MultiLanguage<string>;
  choices: Array<{ title: MultiLanguage<string>; value: number }>;
}

const VOTE_STEPS = [
  'Generate Census Proof',
  'Generate ZK Inputs',
  'Generate & Verify Proof',
  'Submit Vote',
];

export default function VotingScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const orgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID || process.env.ORGANIZATION_ID;
  if (!apiUrl || !orgId) throw new Error('API_URL and ORGANIZATION_ID are required');

  const [details, setDetails] = useState<ElectionDetails | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [address, setAddress] = useState('');
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proofObj, setProofObj] = useState<any>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteId, setVoteId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);

  const [myWeight, setMyWeight] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const api = new VocdoniApiService(apiUrl);
        // 1. discover latest process
        const allIds = await api.listProcesses();
        const allDetails = await Promise.all(
          allIds.map(async (id) => { try { return await api.getProcess(id); } catch { return null; } })
        );
        const filtered = (allDetails as any[]).filter(
          (p) => p && p.organizationId.toLowerCase() === orgId.toLowerCase()
        );
        if (!filtered.length) throw new Error(`No processes found for org ${orgId}`);
        filtered.sort((a, b) => {
          try { return BigInt(a.id) > BigInt(b.id) ? -1 : 1; } catch { return b.id.localeCompare(a.id); }
        });
        const latest = filtered[0];
        const cfg: ElectionDetails = {
          processId: latest.id,
          encryptionPubKey: [latest.encryptionKey.x, latest.encryptionKey.y],
          censusRoot: latest.census.censusRoot,
          metadataUrl: latest.metadataURI,
          censusId: latest.censusId,
        };
        setDetails(cfg);

        // 2. wallet connection & eligibility & proof
        if (window.ethereum) {
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const acct = await signer.getAddress();
          setAddress(acct);
          try {
            const proof = await api.getCensusProof(cfg.censusRoot, acct);
            setProofObj(proof);
            const weightHex = proof.weight;
            const weightNum = BigInt(weightHex.startsWith('0x') ? weightHex.slice(2) : weightHex);
            setEligible(weightNum > 0n);
            setMyWeight(weightNum.toString());
          } catch {
            setEligible(true);
            setMyWeight(null);
          }
        }

        // 3. fetch metadata & questions
        if (!cfg.metadataUrl) throw new Error('Metadata URL undefined');
        const hash = cfg.metadataUrl.split('/').pop()!;
        const meta = await api.getMetadata(hash);
        const qs: Question[] = meta.questions.map(q => ({
          ...q,
          title: q.title || { default: '' },
          description: q.description || { default: '' },
          choices: q.choices.map(c => ({ title: c.title || { default: '' }, value: c.value })),
        }));
        setQuestions(qs);
        const initAns: Record<number, number> = {};
        qs.forEach((_, i) => { initAns[i] = -1; });
        setAnswers(initAns);
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [apiUrl, orgId]);

  // poll vote status after submission
  useEffect(() => {
    if (!voteSubmitted || !voteId || !details) return;
    const api = new VocdoniApiService(apiUrl);
    const interval = setInterval(async () => {
      try {
        const { status } = await api.getVoteStatus(details.processId.replace(/^0x/, ''), voteId);
        setVoteStatus(status);
        if (status === 'settled' || status === 'error') clearInterval(interval);
      } catch (err) {
        console.error('Status polling failed', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [voteSubmitted, voteId, details, apiUrl]);

  const castVote = async () => {
    if (!details || !eligible) return;
    if (Object.values(answers).some(v => v < 0)) {
      setError('Please answer all questions');
      return;
    }
    if (!proofObj) return;
    setError(null);
    setLoading(true);
    setActiveStep(0);

    try {
      const api = new VocdoniApiService(apiUrl);
      const proc = await api.getProcess(details.processId);

      // 1. use existing proof
      setActiveStep(1);
      const myWeight = BigInt(
        proofObj.weight.startsWith('0x') ? proofObj.weight.slice(2) : proofObj.weight
      ).toString();

      // 2. nonce
      const kHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const kStr = BigInt('0x' + kHex).toString();

      // 3. init BallotProof
      const info: InfoResponse = await api.getInfo();
      const sdk = new BallotProof({ wasmExecUrl: info.ballotProofWasmHelperExecJsUrl, wasmUrl: info.ballotProofWasmHelperUrl });
      await sdk.init();
      setActiveStep(2);

      // 4. build field values
      const flat = questions.flatMap((q, i) => {
        const arr = Array(q.choices.length).fill('0');
        arr[answers[i]] = myWeight;
        return arr;
      });
      const fieldValues = flat.concat(Array(8 - flat.length).fill('0')).slice(0, 8);

      const inputs: BallotProofInputs = {
        address: address.replace(/^0x/, ''),
        processID: proc.id,
        encryptionKey: [proc.encryptionKey.x, proc.encryptionKey.y],
        k: kStr,
        ballotMode: proc.ballotMode,
        weight: myWeight,
        fieldValues,
      };
      setActiveStep(3);

      // 5. generate & verify proof
      const { circomInputs, ballot, ballotInputsHash, voteId: outVoteId } = await sdk.proofInputs(inputs);
      const circom = new CircomProof({ wasmUrl: info.circuitUrl, zkeyUrl: info.provingKeyUrl, vkeyUrl: info.verificationKeyUrl });
      const { proof, publicSignals } = await circom.generate(circomInputs);
      if (!(await circom.verify(proof, publicSignals))) throw new Error('Proof verification failed');
      setActiveStep(4);

      // 6. sign & submit
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sigBytes = hexStringToUint8Array(outVoteId);
      const signature = await signer.signMessage(sigBytes);

      const voteReq: VoteRequest = {
        address,
        ballot: { curveType: ballot.curveType, ciphertexts: ballot.ciphertexts },
        ballotInputsHash,
        ballotProof: proof,
        censusProof: proofObj,
        processId: proc.id,
        signature,
        voteId: outVoteId,
      };
      await api.submitVote(voteReq);
      setVoteId(outVoteId.replace(/^0x/, ''));  
      setVoteSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  function hexStringToUint8Array(hex: string): Uint8Array {
    const clean = hex.replace(/^0x/, '');
    return new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  }

  if (loading) return <Box textAlign="center"><CircularProgress/></Box>;
  if (error) return <Alert severity="error" sx={{ mx: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', my: 4 }}>
      <Typography variant="h4" gutterBottom>Cast Your Vote</Typography>

      {!address ? (
        <Alert severity="info">Connect your wallet to vote.</Alert>
      ) : !eligible ? (
        <Alert severity="warning">Your address {address} is not eligible to vote in this election.</Alert>
      ) : voteSubmitted ? (
        <>
          <Alert severity="success">Vote submitted!</Alert>
          {voteStatus && (
            <Alert
              severity={
                voteStatus === 'settled' ? 'success' : voteStatus === 'error' ? 'error' : 'info'
              }
              sx={{ mt: 2 }}
            >
              Vote status: {voteStatus}
            </Alert>
          )}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>Back</Button>
            <Button variant="contained" onClick={onNext} disabled={voteStatus !== 'settled'}>
              Next
            </Button>
          </Box>
        </>
      ) : (
        <>
          {questions.map((q, i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Typography variant="h6">{q.title?.default}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>{q.description?.default}</Typography>
              {eligible && myWeight !== null && (
                <Typography variant="body1" sx={{ mb: 2 }}>
                  <strong>Hence, your vote power in this round is:</strong> {myWeight}
                </Typography>
              )}
              <RadioGroup
                value={answers[i]}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: +e.target.value }))}
              >
                {q.choices.map((c, ci) => (
                  <FormControlLabel
                    key={ci}
                    value={ci}
                    control={<Radio />} 
                    label={c.title.default}
                  />
                ))}
              </RadioGroup>
            </Box>
          ))}

          <Stepper activeStep={activeStep} sx={{ my: 3 }}>
            {VOTE_STEPS.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          <Button
            variant="contained"
            fullWidth
            onClick={castVote}
            disabled={voteSubmitted || Object.values(answers).some((v) => v < 0)}
          >
            {voteSubmitted ? 'Submitting…' : 'Cast Vote'}
          </Button>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>Back</Button>
            <Button variant="contained" onClick={onNext} disabled={!voteSubmitted}>Next</Button>
          </Box>
        </>
      )}
    </Box>
  );
}
