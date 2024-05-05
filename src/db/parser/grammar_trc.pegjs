{
  function createProjection(attributes) {
		let relation = ''
		let columns = []

		if (attributes[0].includes('.')) {
			relation = attributes[0].split('.')[0]
		} else {
			relation = attributes[0]
			attributes.shift()
		}


		attributes.forEach(att => columns.push(att.split('.')[1]))

		return { 
			type: 'projection',
			relation,
			columns
		}
  }
}

start = r: root {
	return r
}

dbDumpStart = dbDumpRoot
dbDumpRoot = a: all {
	return {
		type: 'groupRoot',
		groups: [],
		codeInfo: undefined,
	}
}

root = exp: expression {
	return {
		type: 'trcRoot',
		child: exp,
		child2: undefined
	}
}

expression = '{' proj: projection '|' pred: predicate {
	return {
		projection: proj,
		predicate: pred,
	}
}

projection =  atts: attributes {
	return createProjection(atts)
}

attributes = first: attribute remain: attribute_list {
   return [first, ...remain]
}

attribute_list = atts: (',' attribute)* {
  return atts.flat().filter(att => att !== ',')
}

attribute = ws ident: identifier ws {
	return ident
}

predicate = a: all {
	return {
		type: 'predicate',
		predicate: a
	}
}

ch = [a-zA-Z0-9_.]

identifier = chars: ch+ {
   return chars.join('')
}

all = chs: .* {
    return chs.join('')
}

ws "whitespace" = [ \t\n\r]*