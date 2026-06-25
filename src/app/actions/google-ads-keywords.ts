'use server';

import { GoogleAdsApi, enums } from 'google-ads-api';
import type { KeywordIdea } from '@/lib/types';

export async function fetchKeywordIdeas(seeds: string[], url?: string, language: 'dutch' | 'english' = 'dutch'): Promise<KeywordIdea[]> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerIdRaw = process.env.GOOGLE_ADS_MCC_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !customerIdRaw) {
    throw new Error('Google Ads API credentials or Customer ID are missing from environment variables.');
  }

  // Google Ads API requires customer ID without hyphens
  const customerId = customerIdRaw.replace(/\D/g, '');
  console.log('Using customer ID:', customerId);

  try {
    const client = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken,
    });

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: customerId, // assuming the MCC is the login customer
    });

    // Language Constants: 1010 = Dutch, 1000 = English
    const languageConstant = language === 'dutch' ? 'languageConstants/1010' : 'languageConstants/1000';
    
    // Geo Target Constants: 2528 = Netherlands
    const geoTargetConstants = ['geoTargetConstants/2528'];

    // Prepare Request options
    let requestOptions: any = {
      customer_id: customerId,
      keyword_plan_network: enums.KeywordPlanNetwork.GOOGLE_SEARCH,
      language: languageConstant,
      geo_target_constants: geoTargetConstants,
    };

    if (seeds.length > 0 && url) {
      requestOptions.keyword_and_url_seed = {
        keywords: seeds,
        url: url,
      };
    } else if (seeds.length > 0) {
      requestOptions.keyword_seed = {
        keywords: seeds,
      };
    } else if (url) {
      requestOptions.url_seed = {
        url: url,
      };
    } else {
      throw new Error('You must provide either seed keywords or a URL to fetch keyword ideas.');
    }

    const keywordIdeasResponse = await customer.keywordPlanIdeas.generateKeywordIdeas(requestOptions) as any;
    
    const results: KeywordIdea[] = [];
    
    if (keywordIdeasResponse && keywordIdeasResponse.length > 0) {
      for (const item of keywordIdeasResponse) {
        if (!item.text) continue;
        
        const metrics = item.keyword_idea_metrics || {};
        
        results.push({
          text: item.text,
          avgMonthlySearches: metrics.avg_monthly_searches ? parseInt(metrics.avg_monthly_searches.toString(), 10) : undefined,
          competition: metrics.competition,
          competitionIndex: metrics.competition_index ? parseInt(metrics.competition_index.toString(), 10) : undefined,
          lowCpc: metrics.low_top_of_page_bid_micros ? parseInt(metrics.low_top_of_page_bid_micros.toString(), 10) / 1000000 : undefined,
          highCpc: metrics.high_top_of_page_bid_micros ? parseInt(metrics.high_top_of_page_bid_micros.toString(), 10) / 1000000 : undefined,
        });
      }
    }

    return results;

  } catch (error: any) {
    console.error('Google Ads API gRPC Error:', error);
    
    // Log detailed gRPC errors if available
    if (error.errors && error.errors.length > 0) {
       console.error('Detailed Errors:', JSON.stringify(error.errors, null, 2));
    }
    
    throw new Error(error.message || 'Failed to fetch keyword ideas from Google Ads API');
  }
}
