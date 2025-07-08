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

  useEffect(() => {
    // wrap all logic in async init
    async function init() {
      try {
        const api = new VocdoniApiService(apiUrl);
        // 1. list and filter processes
        const allIds = await api.listProcesses();
        const allDetails = await Promise.all(
          allIds.map(async (id) => {
            try { return await api.getProcess(id); } catch { return null; }
          })
        );
        const filtered = (allDetails as any[]).filter(
          (p) => p && p.organizationId.toLowerCase() === orgId.toLowerCase()
        );
        if (!filtered.length) throw new Error(`No processes found for org ${orgId}`);
        // sort by process ID (highest numeric ID first)
        filtered.sort((a, b) => {
          try {
            const ai = BigInt(a.id);
            const bi = BigInt(b.id);
            return ai > bi ? -1 : ai < bi ? 1 : 0;
          } catch {
            return b.id.localeCompare(a.id);
          }
        });
        // pick newest process by highest ID
        const latest = filtered[0];
        const cfg: ElectionDetails = {
          processId: latest.id,
          encryptionPubKey: [latest.encryptionKey.x, latest.encryptionKey.y],
          censusRoot: latest.census.censusRoot,
          metadataUrl: latest.metadataURI,
          censusId: latest.censusId,
        };
        setDetails(cfg);

        // 2. wallet connection & eligibility & eligibility
        if ((window as any).ethereum) {
          const provider = new BrowserProvider((window as any).ethereum);
          const signer = await provider.getSigner();
          const acct = await signer.getAddress();
          setAddress(acct);
          try {
            const proof = await api.getCensusProof(cfg.censusRoot, acct);
            // parse hex weight
            const weightHex = proof.weight;
            const weightNum = BigInt(weightHex.startsWith('0x') ? weightHex.slice(2) : weightHex);
            setEligible(weightNum > 0n);
          } catch {
            // on any error assume eligible
            setEligible(true);
          }
        }

        // 3. fetch metadata and questions
        if (!cfg.metadataUrl) throw new Error('Metadata URL undefined');
        const hash = cfg.metadataUrl.split('/').pop()!;
        const meta = await api.getMetadata(hash);
        const qs: Question[] = meta.questions.map((q) => ({
          ...q,
          title: q.title || { default: '' },
          description: q.description || { default: '' },
          choices: q.choices.map((c) => ({ title: c.title || { default: '' }, value: c.value })),
        }));
        setQuestions(qs);
        // init answers
        const initAns: Record<number, number> = {};
        qs.forEach((_, idx) => { initAns[idx] = -1; });
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

  if (loading) return <Box textAlign="center"><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mx: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', my: 4 }}>
      <Typography variant="h4" gutterBottom>Cast Your Vote</Typography>

      {!address ? (
        <Alert severity="info">Connect your wallet to vote.</Alert>
      ) : !eligible ? (
        <Alert severity="warning">Your address {address} is not eligible to vote in this election.</Alert>
      ) : (
        <>
          {questions.map((q, i) => (
            <Box key={i} sx={{ mb: 2 }}>
              <Typography variant="h6">{q.title.default}</Typography>
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
            disabled={Object.values(answers).some((v) => v < 0)}
          >
            Cast Vote
          </Button>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>Back</Button>
            <Button variant="contained" onClick={onNext}>Next</Button>
          </Box>
        </>
      )}
    </Box>
  );
}
