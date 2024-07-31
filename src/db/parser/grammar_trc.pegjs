
{
  function createRelationPredicate(relation, variable) {
    return { type: 'RelationPredicate', relation, variable };
  }

  function createPredicate(left, operator, right) {
    return { type: 'Predicate', left, operator, right };
  }

  function createLogicalExpression(left, operator, right) {
    return { type: 'LogicalExpression', left, operator, right };
  }

  function createQuantifiedExpression(quantifier, variable, formula) {
    return { type: 'QuantifiedExpression', quantifier, variable, formula };
  }

  function createNegation(formula) {
    return { type: 'Negation', formula };
  }

	function translateOperator(op) {
		const operators = {
			'or': 'or',
			'∨': 'or',
			'and': 'and',
			'∧': 'and',
			'implies': 'implies',
			'→': 'implies',
		}
		return operators[op]
	}
}

start = expr: TRC_Expr {
	return expr
}

dbDumpStart = dbDumpRoot
dbDumpRoot = a: all {
	return {
		type: 'groupRoot',
		groups: [],
		codeInfo: undefined,
	}
}

all = chs: .* {
  return chs.join('')
}

TRC_Expr
  = '{' _ variable:Variable _ '|' _ formula:Formula _ '}' {
      return { type: 'TRC_Expr', variable, formula, projections: [] };
    }
		/
		'{' _ projections:Projections _ '|' _ formula:Formula _ '}' {
			const variable = projections[0].variable
			const attributeNames = projections.map(p => p.attribute)
      return { type: 'TRC_Expr', variable, formula, projections: attributeNames };
		}

Formula = LogicalExpression

LogicalExpression 
	= left:BaseFormula right:(_ LogicOp _ BaseFormula)* {
      return right.reduce((result, element) => {
			  const op = translateOperator(element[1])
        return createLogicalExpression(result, op, element[3]);
      }, left);
    }

AtomicFormula = RelationPredicate / Predicate



BaseFormula 
	=	AtomicFormula 
	/
	'not' _ formula:BaseFormula {
      return createNegation(formula);
    }
  / '(' _ formula:Formula _ ')' {
      return formula;
    }
  / ('exists' / '∃') _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / ('forAll' / '∀') _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('forAll', variable, formula);
    }

RelationPredicate
  = relation:Relation '(' variable:Variable ')' {
      return createRelationPredicate(relation, variable);
    }

Predicate
  = left:AttributeReference _ operator:RelOp _ right:Value {
      return createPredicate(left, operator, right);
    }
  / left:AttributeReference _ operator:RelOp _ right:AttributeReference {
      return createPredicate(left, operator, right);
    }

AttributeReference
  = variable:Variable '.' attribute:Attribute {
      return { type: 'AttributeReference', variable, attribute };
    }

RelOp = ('=' / '!=' / '<=' / '>=' / '<' / '>')

LogicOp = ('or' / '∨' / 'and' / '∧' / 'implies' / '→')

Variable
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Attribute
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Value
  = "'" chars:[^']* "\'" {
      return chars.join('');
    }
  / digits:[0-9]+ {
      return parseInt(digits.join(''), 10);
    }

Relation
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Projections
  = p: Projection pl: ("," _ Projection)* {
      return [p].concat(pl.map(p => p[2]))
    }

Projection
  = variable:Variable "." attribute:Variable {
      return { variable, attribute }
    }

_ "whitespace"
  = [ \t\n\r]*