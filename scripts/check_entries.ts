import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase/config';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching child accounts globally...");
  const timeEntriesSnap = await getDocs(collection(db, 'timeEntries'));
  console.log(`Total time entries: ${timeEntriesSnap.size}`);
  
  const childIds = new Set();
  timeEntriesSnap.forEach(doc => {
    const data = doc.data();
    if (data.childAccountId) {
      childIds.add(data.childAccountId);
    }
  });

  console.log("\nUnique child account IDs in timeEntries:", Array.from(childIds));

  // Let's print parentClients collections and their childAccounts subcollections
  const parentClientsSnap = await getDocs(collection(db, 'parentClients'));
  console.log(`\nTotal parentClients: ${parentClientsSnap.size}`);
  for (const clientDoc of parentClientsSnap.docs) {
    const clientData = clientDoc.data();
    const childAccountsSnap = await getDocs(collection(db, 'parentClients', clientDoc.id, 'childAccounts'));
    console.log(`Parent client: id="${clientDoc.id}", name="${clientData.clientName}", childAccountsCount=${childAccountsSnap.size}`);
    childAccountsSnap.forEach(childDoc => {
      const childData = childDoc.data();
      console.log(`  -> Child account: id="${childDoc.id}", nickname="${childData.nickname}", googleAdsAccountName="${childData.googleAdsAccountName}"`);
    });
  }
}

run().catch(console.error);
