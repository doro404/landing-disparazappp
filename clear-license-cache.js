/**
 * Script para limpar cache de licença no IndexedDB
 */

// Simular IndexedDB (só funciona no browser)
console.log('⚠️  Este script deve ser executado no console do navegador!\n');
console.log(`
Para limpar o cache, execute no DevTools (F12):

// Opção 1: Limpar IndexedDB da licença
indexedDB.deleteDatabase('srb_store').then(() => console.log('✅ Cache limpo!'));

// Opção 2: Limpar tudo
await new Promise(r => {
  const req = indexedDB.databases();
  req.then(dbs => {
    dbs.forEach(db => indexedDB.deleteDatabase(db.name));
    console.log('✅ Todos os bancos deletados');
  });
});

// Opção 3: Limpar localStorage
localStorage.clear();
console.log('✅ LocalStorage limpo');
`);
