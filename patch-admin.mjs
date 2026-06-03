import fs from 'fs';

function patchFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // add getDoc to import if missing
    if (!content.includes('getDoc,') && !content.includes('getDoc ')) {
        content = content.replace('getDocs,', 'getDoc, getDocs,');
    }

    // Replace the fetch logic
    if (filePath.includes('time-tracking')) {
        content = content.replace(
            `            const [clientsSnap, entriesSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid))),
                getDocs(query(collection(firestore, 'timeEntries'), where('ownerId', '==', user.uid)))
            ]);`,
            `            const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
            const role = userDocSnap.exists() ? userDocSnap.data().role?.toLowerCase() : null;
            const isAdmin = role === 'admin' || user.email === 'billy@pearsonline.nl' || user.email === 'billy@trooper.es' || user.email?.toLowerCase() === 'admin@onlyforward.nl';

            const clientsQuery = isAdmin ? collection(firestore, 'parentClients') : query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid));
            const entriesQuery = isAdmin ? collection(firestore, 'timeEntries') : query(collection(firestore, 'timeEntries'), where('ownerId', '==', user.uid));

            const [clientsSnap, entriesSnap] = await Promise.all([
                getDocs(clientsQuery),
                getDocs(entriesQuery)
            ]);`
        );
    } else if (filePath.includes('invoices')) {
        content = content.replace(
            `            const clientsSnap = await getDocs(query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid)));
            const invoicesSnap = await getDocs(query(collection(firestore, 'invoices'), where('ownerId', '==', user.uid)));`,
            `            const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
            const role = userDocSnap.exists() ? userDocSnap.data().role?.toLowerCase() : null;
            const isAdmin = role === 'admin' || user.email === 'billy@pearsonline.nl' || user.email === 'billy@trooper.es' || user.email?.toLowerCase() === 'admin@onlyforward.nl';

            const clientsQuery = isAdmin ? collection(firestore, 'parentClients') : query(collection(firestore, 'parentClients'), where('ownerId', '==', user.uid));
            const invoicesQuery = isAdmin ? collection(firestore, 'invoices') : query(collection(firestore, 'invoices'), where('ownerId', '==', user.uid));

            const clientsSnap = await getDocs(clientsQuery);
            const invoicesSnap = await getDocs(invoicesQuery);`
        );
    } else if (filePath.includes('services')) {
        content = content.replace(
            `            const [srvSnap, pkgSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'services'), where('ownerId', '==', user.uid))),
                getDocs(query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid)))
            ]);`,
            `            const userDocSnap = await getDoc(doc(firestore, 'users', user.uid));
            const role = userDocSnap.exists() ? userDocSnap.data().role?.toLowerCase() : null;
            const isAdmin = role === 'admin' || user.email === 'billy@pearsonline.nl' || user.email === 'billy@trooper.es' || user.email?.toLowerCase() === 'admin@onlyforward.nl';

            const srvQuery = isAdmin ? collection(firestore, 'services') : query(collection(firestore, 'services'), where('ownerId', '==', user.uid));
            const pkgQuery = isAdmin ? collection(firestore, 'servicePackages') : query(collection(firestore, 'servicePackages'), where('ownerId', '==', user.uid));

            const [srvSnap, pkgSnap] = await Promise.all([
                getDocs(srvQuery),
                getDocs(pkgQuery)
            ]);`
        );
    }

    fs.writeFileSync(filePath, content);
    console.log('Patched', filePath);
}

patchFile('./src/app/dashboard/time-tracking/page.tsx');
patchFile('./src/app/dashboard/invoices/page.tsx');
patchFile('./src/app/dashboard/services/page.tsx');
