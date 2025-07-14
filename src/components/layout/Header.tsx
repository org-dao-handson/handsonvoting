import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import Image from 'next/image';

export default function Header() {
  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* BDLT Logo on the left */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src="/Logo-BDLT-neg.svg"
            alt="BDLT Logo"
            width={120}
            height={40}
            style={{ marginRight: '16px' }}
          />
          <Typography variant="h6" component="div">
            Deep Dive into Blockchain 2025
          </Typography>
        </Box>

        {/* UZH Logo on the right */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src="/uzh-logo-white.svg"
            alt="University of Zurich Logo"
            width={100}
            height={35}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
