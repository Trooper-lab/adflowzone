const admin = require('firebase-admin');

// Initialize with default credentials
admin.initializeApp({
  projectId: 'studio-5373578840-9f1dc'
});
const db = admin.firestore();

async function main() {
  const shareToken = "791366f3-cd7d-4752-a1df-816d19ad740c";
  console.log('Looking for shareToken:', shareToken);

  const snapshot = await db.collection('briefings').where('shareToken', '==', shareToken).get();
  if (snapshot.empty) {
    console.log('Not found');
    return;
  }
  
  const docToCopy = snapshot.docs[0];
  const data = docToCopy.data();
  console.log('Found:', docToCopy.id, data.title);
  
  await db.collection('briefings').doc(shareToken).set(data);
  console.log('Duplicated successfully to ID:', shareToken);
}

main().catch(console.error);
