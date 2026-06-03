import fs from 'fs';

function patchProjects() {
    let content = fs.readFileSync('./src/app/dashboard/projects/page.tsx', 'utf-8');

    // 1. Add collectionGroup if missing
    if (!content.includes('collectionGroup')) {
        content = content.replace(/writeBatch\s*}/, 'writeBatch, collectionGroup }');
    }

    // 2. Fetch query
    content = content.replace(
        "const q = query(collection(firestore, 'users', managerUid, 'todos'));",
        "const q = isAdmin ? query(collectionGroup(firestore, 'todos')) : query(collection(firestore, 'users', managerUid, 'todos'));"
    );

    // 3. Single todo updates: doc(firestore, 'users', managerUid, 'todos', todo.id)
    // Replace with: doc(firestore, 'users', todo.userId || managerUid, 'todos', todo.id)
    content = content.replace(
        /doc\(firestore, 'users', managerUid, 'todos', todo\.id\)/g,
        "doc(firestore, 'users', todo.userId || managerUid, 'todos', todo.id)"
    );

    // 4. Single todo updates: doc(firestore, 'users', managerUid, 'todos', selectedTodo.id)
    content = content.replace(
        /doc\(firestore, 'users', managerUid, 'todos', selectedTodo\.id\)/g,
        "doc(firestore, 'users', selectedTodo.userId || managerUid, 'todos', selectedTodo.id)"
    );

    // 5. Batch updates where it iterates over `id` from `taskIds`:
    // It usually maps: `taskIds.forEach(id => { ... doc(..., id) })`
    // We can replace doc(firestore, 'users', managerUid, 'todos', id) with 
    // doc(firestore, 'users', selectedTodos.find(t => t.id === id)?.userId || managerUid, 'todos', id)
    content = content.replace(
        /doc\(firestore, 'users', managerUid, 'todos', id\)/g,
        "doc(firestore, 'users', selectedTodos.find(t => t.id === id)?.userId || managerUid, 'todos', id)"
    );

    fs.writeFileSync('./src/app/dashboard/projects/page.tsx', content);
    console.log('Patched projects');
}

function patchReports() {
    let content = fs.readFileSync('./src/app/dashboard/reports/page.tsx', 'utf-8');

    if (!content.includes('collectionGroup')) {
        content = content.replace(/writeBatch,/g, 'writeBatch, collectionGroup,');
    }

    content = content.replace(
        `            const todosQuery = query(
                collection(firestore, 'users', managerUid, 'todos'),
                where('childAccountId', '==', account.id),
                where('completed', '==', true)
            );`,
        `            const todosQuery = isAdmin 
                ? query(collectionGroup(firestore, 'todos'), where('childAccountId', '==', account.id), where('completed', '==', true))
                : query(collection(firestore, 'users', managerUid, 'todos'), where('childAccountId', '==', account.id), where('completed', '==', true));`
    );

    // Also fix the doc fetching for completedTodos Snap
    content = content.replace(
        `Promise.all((report.completedTodoRunIds || []).map(id => getDoc(doc(firestore, \`users/\${managerUid}/todos/\${id}\`))))`,
        `Promise.all((report.completedTodoRunIds || []).map(id => {
                    // For admin, we don't know the exact user ID for the todo. But collectionGroup doesn't work for a single doc fetch by ID easily unless we query.
                    // Wait, we can just do a query using collectionGroup!
                    return getDocs(query(collectionGroup(firestore, 'todos'), where('__name__', '==', id)));
                }))`
    );
    // Wait, __name__ == id for collectionGroup doesn't work well sometimes. Actually, we can just map the resulting getDocs. 
    // Let me rewrite the completedTodos mapping logic carefully.
    
    content = content.replace(
        `            const completedTodos = completedTodosSnap
                .filter(s => s.exists())
                .map(s => {
                    const data = s.data();`,
        `            const completedTodos = completedTodosSnap
                .map((snap: any) => {
                    if (snap.docs) { // it's a query snapshot from collectionGroup
                        if (snap.docs.length === 0) return null;
                        const s = snap.docs[0];
                        const data = s.data();
                        let completedAt = data?.completedAt;
                        if (completedAt instanceof Timestamp) completedAt = completedAt.toDate().toISOString();
                        let createdAt = data?.createdAt;
                        if (createdAt instanceof Timestamp) createdAt = createdAt.toDate().toISOString();
                        return { id: s.id, ...data, completedAt, createdAt } as Todo;
                    }
                    if (!snap.exists()) return null;
                    const data = snap.data();`
    ).replace(
        `                    return { id: s.id, ...data, completedAt, createdAt } as Todo;
                });`,
        `                    return { id: snap.id, ...data, completedAt, createdAt } as Todo;
                }).filter(Boolean);`
    );

    fs.writeFileSync('./src/app/dashboard/reports/page.tsx', content);
    console.log('Patched reports');
}

patchProjects();
patchReports();
