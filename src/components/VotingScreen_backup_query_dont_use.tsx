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
  type VoteRequest,
  type BallotProofInputs,
  type BallotProofOutput,
  type InfoResponse,
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

function getCircuitUrls(info: InfoResponse) {
  return {
    ballotProofExec: info.ballotProofWasmHelperExecJsUrl,
    ballotProof: info.ballotProofWasmHelperUrl,
    circuit: info.circuitUrl,
    provingKey: info.provingKeyUrl,
    verificationKey: info.verificationKeyUrl,
  };
}

function padTo(arr: string[], length: number): string[] {
  return arr.concat(Array(length - arr.length).fill('0')).slice(0, length);
}

export default function VotingScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const orgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID || process.env.ORGANIZATION_ID;
  if (!apiUrl || !orgId) throw new Error('API_URL and ORGANIZATION_ID are required');

  const [details, setDetails] = useState<ElectionDetails | null>(null);
  const [participants, setParticipants] = useState<Array<{ key: string; weight: string }>>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeStep, setActiveStep] = useState(-1);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteId, setVoteId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const api = new VocdoniApiService(apiUrl);
        const allIds = await api.listProcesses();
        const detailsList = await Promise.all(
          allIds.map(async (id) => {
            try {
              return await api.getProcess(id);
            } catch {
              return null;
            }
          })
        );

        const filtered = detailsList.filter(
          (d) => d && d.organizationId.toLowerCase() === orgId.toLowerCase()
        ) as Array<any>;

        if (filtered.length === 0) throw new Error(`No processes found for org ${orgId}`);

        filtered.sort((a, b) => {
          const aTime = a.creationTime ? new Date(a.creationTime).valueOf() : 0;
          const bTime = b.creationTime ? new Date(b.creationTime).valueOf() : 0;
          return bTime - aTime;
        });

        const newest = filtered[0];

        console.log("Fetched newest process:", {
          id: newest.id,
          censusId: newest.censusId,
          encryptionKey: newest.encryptionKey,
          censusRoot: newest.census.censusRoot,
          metadataUrl: newest.census.metadataURI,
          creationTime: newest.creationTime,
        });

        const cfg: ElectionDetails = {
          processId: newest.id,
          encryptionPubKey: [newest.encryptionKey.x, newest.encryptionKey.y],
          censusRoot: newest.census.censusRoot,
          metadataUrl: newest.census.metadataURI,
          censusId: newest.censusId,
        };
        setDetails(cfg);

        const census = await api.getParticipants(cfg.censusRoot);
        setParticipants(census.map((p) => ({ key: p.key, weight: p.weight })));

        if ((window as any).ethereum) {
          const prov = new BrowserProvider((window as any).ethereum);
          const signer = await prov.getSigner();
          const acct = await signer.getAddress();
          setAddress(acct);
          setEligible(census.some((p) => p.key.toLowerCase() === acct.toLowerCase()));
        }

        const hash = cfg.metadataUrl.split('/').pop() || '';
        const meta = await api.getMetadata(hash);

        setQuestions(
          meta.questions.map((q) => ({
            ...q,
            title: q.title || { default: '' },
            description: q.description || { default: '' },
            choices: q.choices.map((c) => ({ ...c, title: c.title || { default: '' } })),
          }))
        );

        const init: Record<number, number> = {};
        meta.questions.forEach((_, i) => (init[i] = -1));
        setAnswers(init);
      } catch (e: any) {
        console.error(e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
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
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [i]: +e.target.value }))
                }
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
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
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
