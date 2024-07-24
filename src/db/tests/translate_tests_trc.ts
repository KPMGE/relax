/*** Copyright 2016 Johannes Kessler 2016 Johannes Kessler
*
* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// cspell:disable

import { Relation } from 'db/exec/Relation';
import { RANode } from '../exec/RANode';
import * as relalgjs from '../relalg';


const srcTableR: Relation = relalgjs.executeRelalg(`{
	R.a, R.b, R.c

	1,   a,   d
	3,   c,   c
	4,   d,   f
	5,   d,   b
	6,   e,   f
}`, {}) as Relation;
const srcTableS: Relation = relalgjs.executeRelalg(`{
	S.b, S.d

	a,   100
	b,   300
	c,   400
	d,   200
	e,   150
}`, {}) as Relation;
const srcTableT: Relation = relalgjs.executeRelalg(`{
	T.b, T.d

	a,   100
	d,   200
	f,   400
	g,   120
}`, {}) as Relation;

const relations: {
	R: Relation,
	S: Relation,
	T: Relation,
} = {
	R: srcTableR,
	S: srcTableS,
	T: srcTableT,
};


function exec_trc(query: string): RANode {
	const ast = relalgjs.parseTRCSelect(query);

	const root = relalgjs.relalgFromTRCAstRoot(ast, relations);
	root.check();

	return root;
}

function exec_ra(query: string) {
	return relalgjs.executeRelalg(query, relations);
}


QUnit.module('translate trc ast to relational algebra', () => {

	QUnit.module('predicates', () => {
		QUnit.test('test > predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a > 3 }';
			const queryRa = 'sigma a > 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test < predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a < 3 }';
			const queryRa = 'sigma a < 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test = predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a = 3 }';
			const queryRa = 'sigma a = 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test <= predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a <= 3 }';
			const queryRa = 'sigma a <= 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test >= predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a >= 3 }';
			const queryRa = 'sigma a >= 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test != predicate', function(assert) {
			const queryTrc = '{ t | R(t) and t.a != 3 }';
			const queryRa = 'sigma a != 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});
	})

	QUnit.module('existencial operator(∃)', () => {
		QUnit.test('given ∃ operator with no tuple variable refence and true condition, should return all tuples', function(assert) {
			const queryTrc = '{ t | R(t) and ∃s(S(s) and s.d > 10) }';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = srcTableR.getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('given ∃ operator with no tuple variable reference end false condition, should return no tuples', function(assert) {
			const queryTrc = '{ t | R(t) and ∃s(S(s) and s.d > 1000) }';

			const resultTrc = exec_trc(queryTrc).getResult();

			assert.equal(resultTrc.getNumRows(), 0);
		});
	});

	QUnit.test('test simple relation', function(assert) {
		const query = '{ t | R(t) }';
		const root = exec_trc(query);

		assert.deepEqual(root.getResult(), srcTableR.getResult());
	});
});