import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

// Hardcoded config just for this script if it's missing, but it's better to import from the project
import { firebaseConfig } from './src/firebase/config';

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const shareToken = "791366f3-cd7d-4752-a1df-816d19ad740c";
  console.log('Querying for briefing with shareToken:', shareToken);
  
  const q = query(collection(db, 'briefings'), where('shareToken', '==', shareToken));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log('No briefing found with that shareToken.');
    return;
  }
  
  const docToCopy = snapshot.docs[0];
  const data = docToCopy.data();
  console.log('Found briefing:', docToCopy.id, data.title);
  
  // Now copy it to a new doc with ID = shareToken
  const newRef = doc(db, 'briefings', shareToken);
  await setDoc(newRef, data);
  
  console.log('Successfully copied briefing to ID:', shareToken);
}

main().catch(console.error);
