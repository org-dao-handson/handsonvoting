// File: pages/api/admin/voteAopen.ts
import type { NextApiRequest, NextApiResponse } from 'next';

let voteAopen = true;

type VoteData = { voteAopen: boolean };

export default function voteAopenHandler(
  req: NextApiRequest,
  res: NextApiResponse<VoteData>
) {
  if (req.method === 'GET') {
    return res.status(200).json({ voteAopen });
  }
  if (req.method === 'POST') {
    voteAopen = !voteAopen;
    return res.status(200).json({ voteAopen });
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}