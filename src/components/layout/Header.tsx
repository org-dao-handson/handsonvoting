import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import Image from 'next/image';

export default function Header() {
  return (
    <AppBar position="static" color="primary" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Deep Dive into Blockchain 2025
        </Typography>

        {/* BDLT Logo in center */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          height: '100%'
        }}>
          <Image
            src="/Logo-BDLT-neg.svg"
            alt="BDLT Logo"
            width={120}
            height={40}
            style={{
              maxHeight: '40px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>

        {/* UZH Logo on the right */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          height: '100%'
        }}>
          <Image
            src="/uzh-logo-white.svg"
            alt="UZH Logo"
            width={80}
            height={40}
            style={{
              maxHeight: '40px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
