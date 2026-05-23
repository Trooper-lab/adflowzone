import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load existing env variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET is missing from .env.local');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000/oauth/callback'; // Must match what you entered in Google Cloud Console
const SCOPE = 'https://www.googleapis.com/auth/adwords';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPE}&response_type=code&access_type=offline&prompt=consent`;

console.log('\n======================================================');
console.log('🔗 GOOGLE ADS API AUTHENTICATION');
console.log('======================================================\n');
console.log('1. Go to the following URL in your browser:');
console.log(`\n${AUTH_URL}\n`);
console.log('2. Log in with your Google Ads Manager account.');
console.log('3. Click "Continue" or "Allow" to grant permissions.');
console.log('4. You will be redirected to a localhost URL (it might say "site can\'t be reached" — this is normal!).');
console.log('5. Copy the ENTIRE URL from your browser\'s address bar and paste it below.\n');

rl.question('Paste the full redirected URL here: ', async (inputUrl) => {
  if (!inputUrl) {
    console.error('❌ No URL provided. Exiting.');
    process.exit(1);
  }

  // Extract the code from the URL
  let code = inputUrl;
  try {
    if (inputUrl.includes('code=')) {
      const urlObj = new URL(inputUrl);
      code = urlObj.searchParams.get('code') || inputUrl;
    }
  } catch (e) {
    // If it's not a valid URL but just the code, we'll try using it directly
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Failed to get tokens:', data.error_description || data.error);
      process.exit(1);
    }

    if (!data.refresh_token) {
      console.error('❌ No refresh token returned. This usually happens if you did not force the consent screen. Revoke access from your Google account and try again.');
      process.exit(1);
    }

    console.log('\n✅ Successfully retrieved Refresh Token!');
    
    // Save to .env.local
    const envPath = resolve(process.cwd(), '.env.local');
    let envContent = '';
    try {
      envContent = readFileSync(envPath, 'utf8');
    } catch (e) {
      // File doesn't exist, we'll create it
    }

    if (envContent.includes('GOOGLE_ADS_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/GOOGLE_ADS_REFRESH_TOKEN=.*/g, `GOOGLE_ADS_REFRESH_TOKEN=${data.refresh_token}`);
    } else {
      envContent += `\nGOOGLE_ADS_REFRESH_TOKEN=${data.refresh_token}\n`;
    }

    writeFileSync(envPath, envContent);
    console.log(`✅ Saved GOOGLE_ADS_REFRESH_TOKEN to ${envPath}`);
    console.log('\n🎉 You are fully authenticated! You can now use the Keyword Scout.');
    console.log('⚠️  Note: You must restart your Next.js dev server for it to read the new environment variable.');
    
  } catch (error: any) {
    console.error('❌ Error exchanging code for token:', error.message);
  } finally {
    rl.close();
  }
});
