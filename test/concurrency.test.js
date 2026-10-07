import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRevision, NotebookConflict } from '../src/lib/notebook-transaction.js';
test('first cloud save creates revision one', () => { assert.equal(nextRevision(null, 0), 1); });
test('a current revision advances exactly once', () => { assert.equal(nextRevision({revision:3},3),4); });
test('concurrent or stale saves are rejected', () => { assert.throws(()=>nextRevision({revision:4},3),NotebookConflict); });
test('corrupt cloud revision is rejected', () => { assert.throws(()=>nextRevision({revision:'4'},4),NotebookConflict); });
