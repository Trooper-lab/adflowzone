import * as dotenv from 'dotenv';
import { fetchKeywordIdeas } from '../src/app/actions/google-ads-keywords';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function test() {
  try {
    const results = await fetchKeywordIdeas(['sneakers']);
    console.log('Success! Results:', results.length);
    console.log(results.slice(0, 2));
  } catch (err: any) {
    console.error('Test Failed:', err.message);
  }
}

test();
