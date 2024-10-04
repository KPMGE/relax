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

	1,    a,   d
	3,    c,   c
	4,    d,   f
	5,    d,   b
	6,    e,   f
	1000, e,   k
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
	QUnit.test('test simple relation', (assert) => {
		const query = '{ t | R(t) }';
		const root = exec_trc(query);

		assert.deepEqual(root.getResult(), srcTableR.getResult());
	});

	QUnit.test('test projection', (assert) => {
		const queryTrc = '{ t.a, t.b | R(t) }';
		const queryRa = 'pi a, b (R)';

		const resultTrc = exec_trc(queryTrc).getResult();
		const resultRa = exec_ra(queryRa).getResult();

		assert.deepEqual(resultRa, resultTrc);
	});

	QUnit.module('Logical implication', () => {
		QUnit.test('given logical implication, it should return tuples that match the condition', (assert) => {
			const queryTrc = "{ r | R(r) and r.a > 5 ⇒ r.b = 'e' }";
			// NOTE: p → q ≡ ¬p ∨ q
			const queryRa = "sigma (a <= 5 or b = 'e') (R)";

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.module('Negation', () => {
			QUnit.test('given logical implication, it should not return tuples that match the condition', (assert) => {
				const queryTrc = "{ r | R(r) and not (r.a > 5 ⇒ r.b = 'a') }";
				// NOTE: ¬(A → B) ≡ A ∧ ¬B
				const queryRa = "sigma (a > 5 and b != 'a') (R)";

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});
		});
	});

	QUnit.module('Predicates', () => {
		QUnit.module('Conjunction', () => {
			QUnit.test('given predicate with conjunction, when all the conditions meet, should return tuples', (assert) => {
				const queryTrc = '{ t | R(t) and (t.a < 5 and t.a > 3) }';
				const queryRa = 'sigma a < 5 and a > 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.module('Negation', () => {
				QUnit.test('given predicate with conjunction, when all the conditions meet, should not return tuples', (assert) => {
					const queryTrc = '{ t | R(t) and not (t.a < 5 and t.a > 3) }';
					const queryRa = 'sigma a >= 5 or a <= 3 (R)';

					const resultTrc = exec_trc(queryTrc).getResult().getRows().sort()
					const resultRa = exec_ra(queryRa).getResult().getRows().sort()

					assert.deepEqual(resultTrc, resultRa);
				});
			});
		});

		QUnit.module('Disjunction', () => {
			QUnit.test('given predicate with disjunction, when at least one the conditions meet, should return tuples', (assert) => {
				const queryTrc = '{ t | R(t) and (t.a < 3 or t.a < 5) }';
				const queryRa = 'sigma a < 3 or a < 5 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.module('Negation', () => {
				QUnit.test('given predicate with disjunction, when at least one of the conditions meet, should not return tuples', (assert) => {
					const queryTrc = '{ t | R(t) and not (t.a < 3 or t.a < 5) }';
					const queryRa = 'sigma a >= 3 and a >= 5 (R)';

					const resultTrc = exec_trc(queryTrc).getResult()
					const resultRa = exec_ra(queryRa).getResult();

					assert.deepEqual(resultTrc, resultRa);
				});
			});
		});

		QUnit.module('Negation', () => {
			QUnit.test('> predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a > 3 }';
				const queryRa = 'sigma a <= 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('< predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a < 3 }';
				const queryRa = 'sigma a >= 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('= predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a = 3 }';
				const queryRa = 'sigma a != 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('<= predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a <= 3 }';
				const queryRa = 'sigma a > 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('>= predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a >= 3 }';
				const queryRa = 'sigma a < 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('test != predicate', (assert) => {
				const queryTrc = '{ t | R(t) and not t.a != 3 }';
				const queryRa = 'sigma a = 3 (R)';

				const resultTrc = exec_trc(queryTrc).getResult()
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});
		})

		QUnit.test('test > predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a > 3 }';
			const queryRa = 'sigma a > 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test < predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a < 3 }';
			const queryRa = 'sigma a < 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test = predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a = 3 }';
			const queryRa = 'sigma a = 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test <= predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a <= 3 }';
			const queryRa = 'sigma a <= 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test >= predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a >= 3 }';
			const queryRa = 'sigma a >= 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('test != predicate', (assert) => {
			const queryTrc = '{ t | R(t) and t.a != 3 }';
			const queryRa = 'sigma a != 3 (R)';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});
	})

	QUnit.module('existencial operator(∃)', () => {
		QUnit.test('given ∃ operator with no tuple variable refence and at least one true condition, should return all tuples', (assert) => {
			const queryTrc = '{ t | R(t) and ∃s(S(s) and s.d > 300) }';

			const resultTrc = exec_trc(queryTrc).getResult()
			const resultRa = srcTableR.getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('given ∃ operator with no tuple variable reference and false condition, should return no tuples', (assert) => {
			const queryTrc = '{ t | R(t) and ∃s(S(s) and s.d > 1000) }';

			const resultTrc = exec_trc(queryTrc).getResult();

			assert.equal(resultTrc.getNumRows(), 0);
		});

		QUnit.test('given ∃ operator with tuple variable reference and true condition, should return tuples that match the condition', (assert) => {
			const queryTrc = '{ t | R(t) and ∃s(S(s) and s.b = t.b) }';
			const queryRa = 'pi R.a, R.b, R.c (R join R.b = S.b S)'

			const resultTrc = exec_trc(queryTrc).getResult();
			const resultRa = exec_ra(queryRa).getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.module('Negation', () => {
			QUnit.test('given ¬∃ with no tuple variable refence and at least one exists true condition, should return no tuples', (assert) => {
				const queryTrc = '{ t | R(t) and not ∃s(S(s) and s.d > 300) }';

				const resultTrc = exec_trc(queryTrc).getResult()

				assert.equal(resultTrc.getNumRows(), 0);
			});

			QUnit.test('given ¬∃ with no tuple variable reference and exists false condition, should return all tuples', (assert) => {
				const queryTrc = '{ t | R(t) and not ∃s(S(s) and s.d > 1000) }';

				const resultTrc = exec_trc(queryTrc).getResult();

				assert.deepEqual(resultTrc, srcTableR.getResult());
			});

			QUnit.test('given ¬∃ with tuple variable reference and, return tuples that do not match the condition', (assert) => {
				const queryTrc = '{ t | R(t) and not ∃s(S(s) and (s.d < 200 and t.a < 3)) }';
				const queryRa = 'sigma R.a >= 3 (R)'

				const resultTrc = exec_trc(queryTrc).getResult();
				const resultRa = exec_ra(queryRa).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});
		});
	});

	QUnit.module('universal operator(∀)', () => {
		QUnit.test('given ∀ operator with no tuple variable reference and true condition for some elements but not all, should return no tuples', (assert) => {
			const queryTrc = '{ t | R(t) and ∀s(S(s) and s.d > 300) }';

			const resultTrc = exec_trc(queryTrc).getResult();

			assert.equal(resultTrc.getNumRows(), 0);
		});

		QUnit.test('given ∀ operator with no tuple variable reference and true condition for all elements, should return all tuples', (assert) => {
			const queryTrc = '{ t | R(t) and ∀s(S(s) and s.d > 50) }';

			const resultTrc = exec_trc(queryTrc).getResult();
			const resultRa = srcTableR.getResult();

			assert.deepEqual(resultTrc, resultRa);
		});

		QUnit.test('given ∀ operator with tuple variable reference should return tuples that match the condition', (assert) => {
			const queryTrc1 = '{ r | R(r) and ∀s(S(s) ⇒ s.d < r.a) }';
			const queryTrc2 = '{ r | R(r) and ∀s(S(s) ⇒ s.d > r.a) }';

			const expectedResult1 = exec_ra('sigma a = 1000 (R)').getResult()
			const expectedResult2 = exec_ra('sigma a < 1000 (R)').getResult()

			const resultTrc1 = exec_trc(queryTrc1).getResult();
			const resultTrc2 = exec_trc(queryTrc2).getResult();

			assert.deepEqual(resultTrc1, expectedResult1);
			assert.deepEqual(resultTrc2, expectedResult2);
		});

		QUnit.module('Negation', () => {
			QUnit.test('given ∀ operator with no tuple variable reference and true condition for some elements but not all, should return all tuples', (assert) => {
				const queryTrc = '{ t | R(t) and not ∀s(S(s) and s.d > 300) }';

				const resultRa = srcTableR.getResult();
				const resultTrc = exec_trc(queryTrc).getResult();

				assert.deepEqual(resultTrc, resultRa);
			});

			QUnit.test('given ∀ operator with no tuple variable reference and true condition for all elements, should return no tuples', (assert) => {
				const queryTrc = '{ t | R(t) and not ∀s(S(s) and s.d > 50) }';

				const resultTrc = exec_trc(queryTrc).getResult();

				assert.equal(resultTrc.getNumRows(), 0);
			});

			QUnit.test('given ∀ operator with tuple variable reference should return tuples that do not match the condition', (assert) => {
				const queryTrc1 = '{ r | R(r) and not ∀s(S(s) ⇒ s.d < r.a) }';
				const queryTrc2 = '{ r | R(r) and not ∀s(S(s) ⇒ s.d > r.a) }';

				const expectedResult1 = exec_ra('sigma a != 1000 (R)').getResult()
				const expectedResult2 = exec_ra('sigma a >= 1000 (R)').getResult()

				const resultTrc1 = exec_trc(queryTrc1).getResult();
				const resultTrc2 = exec_trc(queryTrc2).getResult();

				assert.deepEqual(resultTrc1, expectedResult1);
				assert.deepEqual(resultTrc2, expectedResult2);
			});
		});
	});
});