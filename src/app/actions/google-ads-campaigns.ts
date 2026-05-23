'use server';

import { GoogleAdsApi, enums } from 'google-ads-api';
import type { CampaignPerformance, AccountCampaignData } from '@/lib/types';

export async function fetchCampaignPerformance(
  childAccountId: string,
  googleAdsClientId: string,
  dateRange: 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_MONTH' = 'THIS_MONTH'
): Promise<AccountCampaignData> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const mccCustomerIdRaw = process.env.GOOGLE_ADS_MCC_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken || !refreshToken || !mccCustomerIdRaw) {
    throw new Error('Google Ads API credentials or MCC Customer ID are missing from environment variables.');
  }

  const mccCustomerId = mccCustomerIdRaw.replace(/\D/g, '');
  const customerId = googleAdsClientId.replace(/\D/g, '');

  if (!customerId) {
    throw new Error('Geen Google Ads Client ID opgegeven voor dit account.');
  }

  if (customerId === mccCustomerId) {
    throw new Error('Het opgegeven Client ID is het MCC account zelf. Metrieken kunnen alleen per onderliggend (client) account worden opgevraagd.');
  }

  try {
    const client = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken,
    });

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: mccCustomerId,
    });

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.search_impression_share
      FROM campaign
      WHERE segments.date DURING ${dateRange}
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
      ORDER BY metrics.cost_micros DESC
    `;

    const response = await customer.query(query);

    const campaigns: CampaignPerformance[] = [];
    
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;
    let totalConversionsValue = 0;

    for (const row of response) {
      if (!row.campaign || !row.metrics) continue;

      const impressions = row.metrics.impressions ? parseInt(row.metrics.impressions.toString(), 10) : 0;
      const clicks = row.metrics.clicks ? parseInt(row.metrics.clicks.toString(), 10) : 0;
      const costMicros = row.metrics.cost_micros ? parseInt(row.metrics.cost_micros.toString(), 10) : 0;
      const conversions = row.metrics.conversions ? parseFloat(row.metrics.conversions.toString()) : 0;
      const conversionsValue = row.metrics.conversions_value ? parseFloat(row.metrics.conversions_value.toString()) : 0;
      
      const cost = costMicros / 1000000;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const costPerConversion = conversions > 0 ? cost / conversions : 0;
      const roas = cost > 0 ? conversionsValue / cost : 0;
      
      const searchImpressionShare = row.metrics.search_impression_share ? parseFloat(row.metrics.search_impression_share.toString()) : undefined;

      campaigns.push({
        id: row.campaign.id?.toString() || '',
        name: row.campaign.name || 'Unknown Campaign',
        status: row.campaign.status === enums.CampaignStatus.PAUSED ? 'PAUSED' : 
                row.campaign.status === enums.CampaignStatus.ENABLED ? 'ENABLED' : 'UNKNOWN',
        impressions,
        clicks,
        costMicros,
        cost,
        conversions,
        costPerConversion,
        conversionsValue,
        ctr,
        roas,
        searchImpressionShare
      });

      totalImpressions += impressions;
      totalClicks += clicks;
      totalCostMicros += costMicros;
      totalConversions += conversions;
      totalConversionsValue += conversionsValue;
    }

    const totalCost = totalCostMicros / 1000000;

    const totals = {
      impressions: totalImpressions,
      clicks: totalClicks,
      costMicros: totalCostMicros,
      cost: totalCost,
      conversions: totalConversions,
      conversionsValue: totalConversionsValue,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      costPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
      roas: totalCost > 0 ? totalConversionsValue / totalCost : 0,
    };

    return {
      childAccountId,
      period: dateRange,
      lastSyncedAt: new Date().toISOString(),
      campaigns,
      totals
    };

  } catch (error: any) {
    console.error('Google Ads API gRPC Error:', error);
    if (error.errors && error.errors.length > 0) {
       console.error('Detailed Errors:', JSON.stringify(error.errors, null, 2));
    }
    throw new Error(error.message || 'Failed to fetch campaign performance from Google Ads API');
  }
}
