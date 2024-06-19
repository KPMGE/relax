
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
      return { type: 'TRC_Expr', variable, formula };
    }

Formula
  = head:Disjunction tail:(_ ('or' / '∨') _ Disjunction)* {
      return tail.reduce((result, element) => {
        return createLogicalExpression(result, 'or', element[3]);
      }, head);
    }

Disjunction
  = head:Conjunction tail:(_ ('and' / '∧') _ Conjunction)* {
      return tail.reduce((result, element) => {
        return createLogicalExpression(result, 'and', element[3]);
      }, head);
    }

Conjunction
  = 'not' _ formula:Conjunction {
      return createNegation(formula);
    }
  / '(' _ formula:Formula _ ')' {
      return formula;
    }
  / 'exists' _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / '∃' _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('exists', variable, formula);
    }
  / 'forAll' _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('forAll', variable, formula);
    }
  / '∀' _ variable:Variable _ '(' _ formula:Formula _ ')' {
      return createQuantifiedExpression('forAll', variable, formula);
    }
  / RelationPredicate
  / Predicate

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

RelOp
  = '=' / '!=' / '<' / '>' / '<=' / '>='

Variable
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Attribute
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

Value
  = '"' chars:[^"]* '"' {
      return chars.join('');
    }
  / digits:[0-9]+ {
      return parseInt(digits.join(''), 10);
    }

Relation
  = [a-zA-Z_][a-zA-Z0-9_]* {
      return text();
    }

_ "whitespace"
  = [ \t\n\r]*
