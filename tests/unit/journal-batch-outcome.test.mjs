import test from 'node:test';
import assert from 'node:assert/strict';
import {atomicBatchOutcome} from '../../src/lib/accounting/daily-income/batch-outcome.ts';
test('atomic reconciliation confirms only returned requested IDs',()=>{
 assert.deepEqual(atomicBatchOutcome(['a','b'],['b','a']),{confirmed:['b','a'],unconfirmed:[],complete:true});
 assert.deepEqual(atomicBatchOutcome(['a','b'],['a','foreign','a']),{confirmed:['a'],unconfirmed:['b'],complete:false});
 assert.deepEqual(atomicBatchOutcome(['a','b'],undefined),{confirmed:[],unconfirmed:['a','b'],complete:false});
});
