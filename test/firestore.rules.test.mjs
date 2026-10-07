import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { createInitialState } from '../src/data.js';
import { nextRevision } from '../src/lib/notebook-transaction.js';
let env;
const ref = (context, uid = 'alice') => doc(context.firestore(), 'users', uid, 'notebooks', 'bandit');
const payload = (revision = 1) => ({state:createInitialState(),revision,updatedAt:serverTimestamp()});
before(async()=> {
  env=await initializeTestEnvironment({projectId:'demo-bandit',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080}});
});
beforeEach(async()=>{await env.clearFirestore();});
after(async()=>{await env?.cleanup();});
test('owner can create and read a notebook',async()=> {
  const context=env.authenticatedContext('alice');
  await assertSucceeds(setDoc(ref(context),payload()));
  assert.equal((await assertSucceeds(getDoc(ref(context)))).data().state.vehicle.km,30920);
});
test('signed-out users cannot read or write',async()=> {
  const context=env.unauthenticatedContext();
  await assertFails(getDoc(ref(context)));
  await assertFails(setDoc(ref(context),payload()));
});
test('a different user cannot access the owners notebook',async()=> {
  await setDoc(ref(env.authenticatedContext('alice')),payload());
  const context=env.authenticatedContext('bob');
  await assertFails(getDoc(ref(context)));
  await assertFails(setDoc(ref(context),payload(2)));
  await assertSucceeds(setDoc(ref(context,'bob'),payload()));
});
test('owner update requires an incremented revision and a server timestamp',async()=> {
  const target=ref(env.authenticatedContext('alice'));
  await setDoc(target,payload());
  await assertFails(setDoc(target,payload(1)));
  await assertFails(setDoc(target,payload(3)));
  await assertFails(setDoc(target,{...payload(2),updatedAt:new Date(0)}));
  await assertSucceeds(setDoc(target,payload(2)));
});
test('malformed or unexpected fields are refused',async()=> {
  const target=ref(env.authenticatedContext('alice'));
  await assertFails(setDoc(target,{...payload(),admin:true}));
  const bad=payload();bad.state.vehicle.km=-1;
  await assertFails(setDoc(target,bad));
  const fractional=payload();fractional.state.vehicle.km=30920.5;
  await assertFails(setDoc(target,fractional));
  const malformed=payload();malformed.state.events='invalid';
  await assertFails(setDoc(target,malformed));
});
test('deletes and arbitrary document paths are refused',async()=> {
  const context=env.authenticatedContext('alice');const target=ref(context);
  await setDoc(target,payload());
  await assertFails(deleteDoc(target));
  await assertFails(setDoc(doc(context.firestore(),'users','alice','notebooks','other'),payload()));
});
test('simultaneous transactions cannot silently overwrite each other',async()=> {
  const context=env.authenticatedContext('alice');const target=ref(context);
  await setDoc(target,payload());
  const write=async(value)=>runTransaction(context.firestore(),async tx=> {
    const snapshot=await tx.get(target);const revision=nextRevision(snapshot.data(),1);
    const data=payload(revision);data.state.vehicle.km=value;tx.set(target,data);
  });
  const results=await Promise.allSettled([write(31000),write(32000)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await getDoc(target)).data().revision,2);
});
