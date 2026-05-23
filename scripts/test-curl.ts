import * as dotenv from 'dotenv';
import { getGoogleAdsAccessToken } from '../src/lib/google-ads-auth';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function test() {
  const customerId = process.env.GOOGLE_ADS_MCC_CUSTOMER_ID?.replace(/\D/g, '');
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const accessToken = await getGoogleAdsAccessToken();

  const endpoint = `https://googleads.googleapis.com/v17/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`;
  console.log(`Endpoint: ${endpoint}`);

  const body = {
    keywordSeed: {
      keywords: ["example keyword"]
    },
    language: "languageConstants/1000",
    geoTargetConstants: ["geoTargetConstants/2840"],
    keywordPlanNetwork: "GOOGLE_SEARCH"
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'developer-token': developerToken!,
      'login-customer-id': customerId!,
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Response:', text);
}

test();
