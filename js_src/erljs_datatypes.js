/* Copyright 2008-2011, Witold Baryluk <baryluk@smp.if.uj.edu.pl>
 * erljs project
 */

// Inspired by base2 and Prototype
// http://ejohn.org/blog/simple-javascript-inheritance/
(function(){
var initializing = false, fnTest = (/xyz/).test(function(xyz){xyz("xyz");}) ? /\b_super\b/ : /.*/;
// The base Class implementation (does nothing)
this.Class = function(){};
// Create a new Class that inherits from this class
Class.extend = function(prop) {
	var _super = this.prototype;
	// Instantiate a base class (but only create the instance,
	// don't run the init constructor)
	initializing = true;
	var prototype = new this();
	initializing = false;
	// Copy the properties over onto the new prototype
	for (var name in prop) {
		// Check if we're overwriting an existing function
		prototype[name] =
				(typeof prop[name] == "function" && typeof _super[name] == "function" && fnTest.test(prop[name]))
				?
				(function(name1, fn){
					return function() {
						var tmp = this._super;
						// Add a new ._super() method that is the same method but on the super-class
						this._super = _super[name1];
						// The method only need to be bound temporarily, so we remove it when we're done executing
						var ret = fn.apply(this, arguments);
						this._super = tmp;
						return ret;
					};
				})(name, prop[name])
				:
				prop[name];
	}
	// The dummy class constructor
	function Class() {
		// All construction is actually done in the init method
		if (!initializing && this.init) {
			this.init.apply(this, arguments);
		}
	}
	// Populate our constructed prototype object
	Class.prototype = prototype;
	// Enforce the constructor to be what we expect
	Class.constructor = Class;
	// And make this class extendable
	Class.extend = arguments.callee;
	return Class;
}; // Class.extend
})();

/* Similar to Prototype's bind, or ES5 bind
 * It basically ensures that when calling 'f', the 'this' in the body will reffer to 'newThis'
 * Note: use returned function as a new 'f'
 * Use as bind(foo, obj2) or foo.bind(obj2)
 * epscially usefull as ff = obj.foo.bind(obj),
 * to make ff real delegate which will have 'this' pointing to original object
 *
 * Note: In prototype, Function.prototype.bind have additional arguments which will be prepended to function call
 * Note: In ES5, there is already function behaving exaclty like Prototype's one.
 *
 * Here we are just adding simple emulation, in case it is missing.
 */
if (!Function.prototype.bind) {
	Function.prototype.bind = function(newThis) {
		var f = this; // need a copy
		return function() {
			f.apply(newThis, arguments);
		};
	};
	function bind(f, newThis) {
		return function() {
			f.apply(newThis, arguments);
		};
	}
} else {
	function bind(f, newThis) {
		return f.bind(newThis);
	}
}

// control behaviour of .toString() function
var erljs_toString_pretty_printing = false;

// Erlang type system
var ETerm = Class.extend({
	type: function() { return "unknown"; },
	is: function(T) { return false; },
	toString: function() {
		throw "unknown eterm";
	},
	isastring: function() { return false; }
});

var AllAtomsNamesToInt = {};
var AllAtomsNamesFromInt = {};
var AllAtomsMaxId = 1;

var EAtom = ETerm.extend({
	init: function(AtomName_) {
		// TODO: perform validation of atom value, double dot, trailing dot, single quotas, lowercase first letter.

		if (AtomName_ in AllAtomsNamesToInt) {
			this.A = AllAtomsNamesToInt[AtomName_];
		} else {
			this.A = (AllAtomsMaxId++);
			AllAtomsNamesToInt[AtomName_] = this.A;
			AllAtomsNamesFromInt[this.A] = AtomName_;
		}
	},
	type: function() { return "atom"; },
	is: function(T) { return (T=="atom"); },
	atom_id: function() { return this.A; },
	atom_name: function() { return AllAtomsNamesFromInt[this.A]; },
	toString: function() {
		var a = AllAtomsNamesFromInt[this.A];
		// TODO: can be use [\w@] as shortcut to [a-zA-Z_0-9@] ?
		                                         // reserved atoms. note: throw is not reserved!
		if (/^[a-z][a-zA-Z_0-9@]*$/.test(a) && !(/^(try|fun|catch|end|begin|if|case|of|when|or(else)?|and(also)?|b(or|and|xor|not|sr|sl))$/.test(a))) {
			return a;
		//} else if (/^[a-z](\.[a-zA-Z_0-9@]+)*\.?$/.test(a)) { // we are allowed to display few other atoms directly (with single dots inside),
		//	return a;                                          // but we will not as EVM doesnt do so.
//		} else if (a.indexOf("'")<0) { // not needed special case of else below.
//			return "'"+a+"'";
		} else {
			// todo: perform additional transliteration for example of: \n \t \r \b \f \v \e
			// not printable characters change to octal notation \012   (always with 3 digits, even if it can be shorter and still correct atom)
			// http://blog.versed.se/2008/07/transliterate-in-javascript.html
			/*
			//or
			a.replace(/([\n\t\r\b\f\v\e'])/g, function() {
				//return {
				//	"\n":"\\n",
				//}[x];
				return "\\"+x;
			});
			*/
			return "'"+a.replace("'","\\'")+"'";
		}
	}
});

// also cache object references for atoms
function get_atom(AtomName_, existing) {
}

var EInteger = ETerm.extend({
	init: function(Integer_) { this.IntegerValue = Integer_; },
	type: function() { return "integer"; },
	is: function(T) { return (T=="integer"); },
	toString: function() {
		return this.IntegerValue; // be sure to include decimal dot
	}
});
var EFloat = ETerm.extend({
	init: function(Float_) { this.FloatValue = Float_; },
	type: function() { return "float"; },
	is: function(T) { return (T=="float"); },
	toString: function() {
		return this.FloatValue; // be sure to include decimal dot
	}
});
var ETuple = ETerm.extend({
	init: function(X) { if (X instanceof Array) { this.TupleArity=X.length; this.TupleData=X; } else { this.TupleArity=X; this.TupleData=[]; } },
	type: function() { return "tuple"; },
	is: function(T) { return (T=="tuple"); },
	put: function(Index, Value) { this.TupleData[Index] = Value; },
	get: function(Index) { if (Index > this.TupleArity) { throw ""; } return this.TupleData[Index];  },
	tuple_arity: function() { return this.TupleArity; },
	toString: function() {
		var r = "";
		for (var i = 0; i < this.TupleArity; i++) {
			if (i) {
if (erljs_toString_pretty_printing) {
				r += ", ";
} else {
				r += ",";
}
			}
			if (this.TupleData[i] !== undefined) {
				r += this.TupleData[i].toString();
			} else {
				r += "EMPTY";
			}
			//r += this.TupleData[i];
		}
		return "{"+r+"}";
	}
});

var EListAny = ETerm.extend({init: function() {}});
var EListNonEmpty = EListAny.extend({init: function() {}});

var str_esc = {
	92: "\\\\", // \
	8: "\\b", // \b
	9: "\\t", // \t
	10: "\\n", // \n
	13: "\\r", // \r
	11: "\\v", // \v
	12: "\\f", // \f
	27: "\\e", // \e - ASCII 27
	34: "\\\"" // "
};

var EList = EListNonEmpty.extend({
	init: function(Head_, Tail_) {
	//this.H = Head_; this.T = Tail_;
	this._=[Head_,Tail_];
	},
	type: function() { return "list"; },
	is: function(T) { return (T=="list"); },
	empty: function() { return false; },
	head: function() {
		return this._[0];
	},
	tail: function() {
		//return this.T;
		return this._[1];
	},
	sethead:function(h) {
		this._[0]=h;
	},
	settail:function(t) {
		this._[1]=t;
	},
	// TODO: make this function tail recursive and with accumulator
	toString: function() {
		var h = this.head();
		var l = this.isastring();
		if (l>=0) {
			return this.toStringLimited(l);
		}
		var t = this.tail();
		if (t instanceof EListAny) {
			return "["+h.toString()+t.toStringJust()+"]";
		} else {
			return "["+h.toString()+"|"+t.toString()+"]";
		}
	},
	// TODO: make this function tail recursive and with accumulator
	toStringJust: function() {
		var h = this.head();
		var t = this.tail();
		if (t instanceof EListAny) {
if (erljs_toString_pretty_printing) {
			return ", "+h.toString()+t.toStringJust();
} else {
			return ","+h.toString()+t.toStringJust();
}
		} else {
			return ","+h.toString()+"|"+t.toString();
		}
	},
	// TODO: make this function tail recursive
	toStringLimited: function(l) {
		var x = this;
		var r = "\"";
		while (x instanceof EList) {
			var i = x.head();
			var e = str_esc[i];
			if (e) {
				r += e;
			} else {
				r += String.fromCharCode(i);
			}
			x = x.tail();
		}
		r += x.toStringLimited(l);
		return r;
	},
	// converts lists of integers from range 0-255 to JS string. usefull in list_to_* functions, prints, etc.
	toByteList: function() {
		var l = this.is_byte_list();
		if (l < 0) {
			return null;
		}
		var x = this;
		// TODO: preallocate array of size l and use it
		var r = "";
		while (x instanceof EList) {
			var i = x.head();
			var e = str_esc[i];
			if (e) {
				r += e;
			} else {
				r += String.fromCharCode(i);
			}
			x = x.tail();
		}
		// At the end we will have EListNil (+="") or EListString (+=something)
		r += x.toByteList(l);
		return r;
	},
	// TODO: we can memoize this! and use in erlang:length/1 !
	//       Remember about improper lists.
	length: function() { return list_len(this); },
	// similar like bellow, but we check if list contains only 0..255 integers
	// TODO: make it tail recursive
	is_byte_list: function() {
		var h = this.head();
		if (!is_integer(h)) {
			return -1;
		}
		if (h > 255 || h < 0) {
			return -1;
		}
		var l = this.tail().is_byte_list();
		if (l < 0) { return l; }
		return l+1;
	},
	// return lenght of string, or -1 if it is not a printable list
	// TODO: we can memoize memoize this.
	// TODO: make it tail recursive
	isastring: function() {
		var h = this.head();
		// TODO: make this function iterative
		if (!is_integer(h)) {
			return -1;
		}
		if (! ( ( (32<=h) && (h<=126) ) || str_esc[h])) {
			return -1;
		}
		var l = this.tail().isastring();
		if (l < 0) { return l; }
		return l+1;
	}
});

function list_len(t) {
	var l = 0;
	while (t instanceof EList) {
		t = t.tail();
		l++;
	}
	if (t instanceof EListString) {
		l += t.length();
	} else if (t instanceof EListNil) {
		
	} else {
		throw "improper list";
	}
	return l;
}

// it is not a EList!
var EListNil = EListAny.extend({
	init: function() { },
	type: function() { return "list"; },
	is: function(T) { return (T=="list"); },
	empty: function() { return true; },
	toString: function() { return "[]"; },
	toStringJust: function() { return ""; },
	toStringLimited: function(l) { return "\""; },
	length: function() { return 0; },
	is_byte_list: function() { return 0; },
	toByteList: function() { return ""; },
	isastring: function() { return 0; }
});

// slightly more efficient representation and lazy tail
var EListString = EListNonEmpty.extend({
	init: function(S_, i_) {
		if (i_ === undefined) {
			i_ = 0;
		}
		assert(i_ < S_.length);
		this.S = S_; this.i=i_;
	},
	type: function() { return "list"; },
	is: function(T) { return (T=="list"); },
	// this.empty(), should be always false, because there is EListNil for empty list
	// there is also no reason for EListString with empty string, EListNil is just fine.
	// only real reason can be to have display "", and not [].
	empty: function() { return (this.S.length==this.i); },
	head: function() { return this.S.charCodeAt(this.i); },
	tail: function() {
/*
		if (!this.tailmem) { // memoize
			this.tailmem = new EListString(this.S,this.i+1);
		}
		return this.tailmem;
*/
		if (this.i+1==this.S.length) {
			return new EListNil();
		} else {
			return new EListString(this.S,this.i+1);
		}
	},
	// TODO: escape \n\t\b\r\v\f\e and other binary data to \001
	toString: function() {
		return "\"" + this.toStringLimited();
//		return this.S.substr(this.i).replace(/"/g, "\\\"")+ "\"";
	},
	toStringJust: function() { return "|\"" +this.S.substr(this.i).replace(/"/g, "\\\"")+ "\""; },
	toStringLimited: function(l) {
		return this.S.substr(this.i).replace(/([\\\b\t\n\r\v\f\33"])/g,
			// " // <- workaround for stupid syntax highlighting
		function (str, submatch1, offset, totalstring) {
			return {
				"\\": "\\\\",
				"\b": "\\b",
				"\t": "\\t",
				"\n": "\\n",
				"\r": "\\r",
				"\v": "\\v",
				"\f": "\\f",
				/*"\e"*/ "\33": "\\e", // ASCII 27,   octal 33
				"\"": "\\\""
			}[submatch1];
		})+ "\"";
	},
	length: function() { return this.S.length-this.i; },
	is_byte_list: function() { return this.length(); },
	toByteList: function() {
		return this.S.substr(this.i);
	},
	isastring: function() { return this.length(); }
});

var EFun = ETerm.extend({
	type: function() { return "fun"; },
	is: function(T) { return T=="fun"; },
	function_modulename: function() { throw "abstract fun method"; },
	function_name: function() { throw "abstract fun method"; },
	function_arity: function() { throw "abstract fun method"; },
	fun_arity: function() { throw "abstract fun method"; },
	fun_type: function() { throw "abstract fun method"; }
});

var EFunLocal = EFun.extend({
	// module, fun name in module, fun arity (for call), env arity (for makeing), uniq id, binded values for make
	init: function(M_, FunMFA_, FunA_, EnvA_, ID_, Env_, Pid_, Uniq_) {
		assert(Env_.length == EnvA_);
		assert(FunMFA_[2] == FunA_ + EnvA_);
		this.M = M_;
		// it is normally "-"+FunctionNameInWhichItIsDefined+"/"+ArityOfFunctionInWhichItIsDefined+"-fun-"+IndexNumberOfFunInThisFunction
		this.FunMFA = FunMFA_;
		// arity of fun. what is number of arguments needed to be provided be caller in call_fun?
		this.FunA = FunA_;
		// it is index of the fun as the funs in the whole module. runtime can store them in some separate table
		this.ID = ID_;
		// used to detect module reloading, and call proper (possibly old) module.
		this.Uniq = Uniq_;
		// which pid created this fun (so it can reference it's data).
		this.Pid = Pid_;
		// additional variables for the fun function (binded already)
		this.Env = Env_;
	},
	toString: function() {
		return "#Fun<"+this.M+"."+this.ID+"."+this.Uniq+">"; // TODO, remember about dots in atoms!
	},
	// modulename, functioname, and arity of function M:FunF whichi implements this fun. it have Env + actuall parameters.
	function_modulename: function() {
		return this.FunMFA[0];
	},
	function_name: function() {
		return this.FunMFA[1];
	},
	function_arity: function() {
		//return this.FunA + this.Env.length;
		return this.FunMFA[2];
	},
	// actuall paramater number needed for calling
	fun_arity: function() {
		return this.FunA;
	},
	fun_type: function() { return "local"; }
});

var EFunExternal = EFun.extend({
	// Note M, F, A can be both JS string/integer.
	// But it will more probably be EAtom/EInteger originating from erlang:make_fun/3
	// TODO: normalize types, so it will be simpler to use in:
	//    erlang:fun_info/1,2, erlang:apply/2 and call_fun opcode.
	init: function(M_, F_, A_) {
		this.M = M_;
		this.F = F_;
		this.A = A_;
	},
	// BUG erlang:fun_to_list(fun 's.d'.'d.h'/5) = "#Fun<s.d.d.h.5>". not very good way.
	// fortunetly there is no general list_to_fun (becuase of garabage collectin of env and lack of reference).
	toString: function() {
		return "#Fun<"+this.M+"."+this.F+"."+this.A+">";
	},
	// modulename, functioname, and arity of function
	function_modulename: function() {
		return this.M;
	},
	function_name: function() {
		return this.F;
	},
	function_arity: function() {
		return this.A;
	},
	fun_arity: function() {
		return this.A;
	},
	fun_type: function() { return "external"; }
});

// we do not need to support fun M/A, because it is done using helper some helper function.

var __refs_ids = 1;
var ERef = ETerm.extend({
	init: function() { this.refid = __refs_ids++; },
	type: function() { return "ref"; },
	is: function(T) { return T=="ref"; },
	toString: function() {
		return "#Ref<0.0.0."+this.refid+">";
	}
});

var __pids_ids = 1;
var EPid = ETerm.extend({
	init: function() { this.pid = __pids_ids++; },
	type: function() { return "pid"; },
	pid_type: function() { return "local"; },
	is: function(T) { return T=="pid"; },
	toString: function() {
		return "<0."+this.pid+".0>";
	}
});

// TODO: typed JS arrays. See:
//   webgl proposal: https://cvs.khronos.org/svn/repos/registry/trunk/public/webgl/doc/spec/TypedArray-spec.html
//   other approaches: http://wiki.commonjs.org/wiki/Binary
//   older webgl proposal: http://people.mozilla.com/~vladimir/jsvec/TypedArray-spec.html
var EBinary = ETerm.extend({
	init: function(total_byte_size_) {
		this.total_byte_size = total_byte_size_;
		this.raw_data = [];
	},
	type: function() { return "binary"; },
	is: function(T) { return T=="binary"; },
	toString: function() {
		var r = "<<";
		for (var i = 0; i < this.total_byte_size; i++) {
			if (i) {
				r += ",";
			}
			// decimal representation of byte in raw_data[i]
			r += this.raw_data[i];
		}
		r += ">>";
		return r;
	},
	binary_byte_size: function() {
		return this.total_byte_size;
	}
});


/** mini parser of erlang data terms (literals)
 *
 * No pid,port,fun,ref or any expressions allowed.
 *
 * (N - not implemented)
 *   decimal integers:   1, -5, 0, 1412, +33 // arbitrary precisions
 *N    2#1010101,  binary numbers
 *N    16#112b12a121a, base 16, etc.
 *N    $a  - ascii code for a.
 *N    $Ł  - unicode code pint for Ł
 *   float  1.0e309, 0.412, 4.12e-55
 *   atoms:  abc, // lowercas first latter, then letters, _, numbers. no two consecutive dots allowed or even single at the end. single dot at begining is ignored, two are not allowed.
 *           'ABA$a', // with escaping ' using \'. dots in any number allowed everywhere.
 *   empty tuple: {}
 *   one tuple: {a}
 *   two tuple: {a,b}
 *   empty list: []
 *   one element list: [a]
 *   many element lists:    [a,b,c,d]
 *   inproper lists:  [a,b,c|d]
 *   string:   "xyz"  // and escaping rules
 *N  binaries and bitstrings.  <<1:8,2,3/unsigned,123,123/integer>>,<<"asdasd">>.
 *
 * Note: remember that if some atoms doesn't exists yet, it will be added to the global hash table
 *       if you have some untrusted source of atoms, or they are automatically generated,
 *       this table can grow to arbitrary large sizes. Use "existing" flag/version to only allow existing atoms.
 *
 * TODO: Add Pid/Port/Fun/Ref serialization. Pid and Ref probably first.
 * TODO: Add bitstrings and binaries when erljs will have binaries support. Bitstrings are simpler, so first.
 *
 * Note: beyond the fact that it only handles some data types, no expressions are allowed.
 *       Even things like this  {(2)}, is not allowed as "(...)" is expression not literal.
 *
 * Note: This procedure is not Unicode-aware.
 *
 * TODO: put size of big lists, strings and binaries at the begining of them, so two pass algorithm isn't needed.
 *
 * See Also: also http://www.erlang.org/eeps/eep-0018.html
 * http://www.erlang.org/eeps/eep-0021.html
*/
function eterm_decode(s) {
	return eterm_decode_(s, false);
}
function eterm_decode_existing_atoms(s) {
	return eterm_decode_(s, true);
}
function eterm_decode_(s,existing) {
	var t = get_next(s,0,existing);
	if (t[1] != s.length) {
		throw "excesive data";
	}
	return t[0];
}
// Logical xor. Thanks for this short and universally working version. http://www.howtocreate.co.uk/xor.html :)
function lnotxor(a,b){return !a == !b;}

// parse next chunk of data, returns [readed_and_parsed_object, position_of_next_element_to_read_from_s]
// TODO: make it slighlty smaller (now it have 38 branches), or divide into few smaller functions.
function get_next(s,i,existing) {
	var m;
decode_again:
while (true) {
	switch (s[i++]) {
		case "{":
			// skip white space
			while ((s[i] == " " || s[i] == "\t" || s[i] == "\n" || s[i] == "\r") && i < s.length) {
				i++;
			}
			if (s[i] == "}") {
				return [new ETuple(0), i+1];
			}
			var k = new Array();
			var n = 0;
tuple_loop:
			while (true) {
				var t = get_next(s, i, existing);
				k[n++] = t[0];
				i = t[1];
				// skip white space
				while ((s[i] == " " || s[i] == "\t" || s[i] == "\n" || s[i] == "\r") && i < s.length) {
					i++;
				}
				switch (s[i++]) {
					case ",":
						continue tuple_loop; // TODO: allow trailing comma as proposed in EEP
					case "}":
						break tuple_loop;
					default:
						throw "syntax error in tuple at "+i;
				}
			}
			return [new ETuple(k), i];
		case "[":
			while ((s[i] == " " || s[i] == "\t" || s[i] == "\n" || s[i] == "\r") && i < s.length) {
				i++;
			}
			if (s[i] == "]") {
				return [new EListNil(), i+1];
			}
			var proper = true;
			var r0 = new EList(-1233,-4123), r = r0;
list_loop:
			while (true) {
				var t = get_next(s, i, existing);
				var r2 = new EList(t[0],-142);
				r.settail(r2);
				r = r2;
				i = t[1];

				// skip white space
				while ((s[i] == " " || s[i] == "\t" || s[i] == "\n" || s[i] == "\r") && i < s.length) {
					i++;
				}
				switch (s[i++]) {
					case ",": // TODO: allow trailing comma in proper lists as proposed in EEP
						continue list_loop;
					case "|":
						proper = false;
					case "]": // fallthrough
						break list_loop;
					default:
						throw "syntax error in list at "+i;
				}
			}
			if (proper) {
				r.settail(new EListNil());
			} else {
				var t = get_next(s, i, existing);
				r.settail(t[0]);
				i = t[1];
				while ((s[i] == " " || s[i] == "\t" || s[i] == "\n" || s[i] == "\r") && i < s.length) {
					i++;
				}
				if (s[i++] != "]") {
					throw "bad list at about "+i;
				}
			}
			return [r0.tail(), i];
		case "$": // integer, asci code
			// exceptions: not $\ but $\\, $\n, etc. 
			if (s[i]!="\\") {
				return [s.charCodeAt(i), i+1]; // TODO: is this safe to perform ++ ?
			} else {
// this looks to be not correct, as it is identical as first branch.
				return [s.charCodeAt(i), i+1];
			}
		case "#":
			throw "not supported pid, port, ref or fun at "+i;
		case "<":
			if (s[i++] == "<") {
				// binary
				// now performing double pass algorithm, first to determine size of binary, second to fill it with values.
				// TODO: to communication with Erlang side we should use better approach where size of binary is at the begining.
				if (s[i++] == "\"") {
					// binary string syntax, <<"xyz">>
					throw "Binaries parsing not fully implemented yet. Binary string at "+i;
				} else {
					// simple binary syntax <<3,5,6,7,8:3>>, we can also assume that no integer is bigger than 3 decimal digits.
					// we need count number of comas ",", and position of ">>"
					var rS = /<<(\d{1,3}(,\d{1,3})*)?>>/ig;
					rS.lastIndex = i-3;
					m = rS.exec(s);
					if (!m || m.index != i-3) {
						throw "bad syntax in string at about "+(i-3);
					}
					var b = m[1].split(",");
					var b_size = b.length;
					var b2 = new EBinary(b_size);
					for (var j = 0; j < b_size; j++) {
						b2.raw_data[j] = parseInt(b[j], 10);
					}
					return [b2, rS.lastIndex];
				}
				// as input it is allowed to also use more complex syntax for binary,
				// but it will be serialized to simpler syntax so we do not need it right now
				//   <<1:1,3:127>> == <<128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3>>.
				//   <<"xyz","abc">> == <<"xyzabc">>
				//   <<"xyz",77,"X",23,$f>> == <<120,121,122,77,88,23,102>>
				//   <<5:6,22:7,56:12,44:1>> == <<20,176,28,0:2>>
				//   <<6.21e4/float>> == <<64,238,82,128,0,0,0,0>> // double precision (default :64), one can also use :32 as single precision.
				//   <<6.1/float>> == <<64,24,102,102,102,102,102,102>>
				return b;
			} else {
				throw "not supported pid, port, ref or fun at "+i;
			}
		case "\"": // list in the string form
			i--;
			// TODO: add | for tail notation: "asd"|"bce", but also "asd"|13, or "asd"|[3,6666,123,555]|"asdczx"
			var rS = /"((?:[^"\\]|\\["'\\btnvfre A-Z0-9a-wyz]|\\x[0-9a-fA-F][0-9a-fA-F])*)"/ig;
			// '
			rS.lastIndex = i;
			m = rS.exec(s);
			if (!m || m.index != i) {
				throw "bad syntax in string at about "+i;
			}
			if (m[1].length === 0) {
				return [new EListNil(), rS.lastIndex];
			} else {
				// TODO: \o, \oo, \ooo, \xFF syntax
				var m1 = m[1].replace(/\\(.)/g, function (str, submatch1, offset, totalstring) {
					var esc = {
						// "\"": "\"", // handled bellow
						"\\": "\\",
						"b": "\b",
						"t": "\t",
						"n": "\n",
						"r": "\r",
						"v": "\v",
						"f": "\f",
						"e": "\33" // String.fromCharCode(27)
					}[submatch1];
					if (esc) {
						return esc;
					} else {
						if (submatch1 == "x") {
							throw "hex in string not implemented";
						}
						return submatch1;
					}
				});
				return [new EListString(m1,0), rS.lastIndex];
			}
		case "'":
				// allowed char:   a-z A-Z 0-9 - ` ~ ! @ # $ % ^ & * ( ) _ = - + [ ] { } ; \ : " | , . / < > ? SPACE
				// allowed: \\ or \' or \" (but " doesn't need to be escaped)
				// most special characters can (but do not need) be escaped also: ` ~ ! @ # $ % (CAN NOT BE ^) & * ( ) _ - = + [ ] { } ; : (MUST BE ' " \) , . < > / ?
				// pracitcally all letters can (but should not be) be escaped, exceptions:
				// \x00 - \xff (\xFF)  --- hexdecimal notation,   \xHH is illegal
				// \0 - \7, \00 - \77, \000 - \377  -- octal.    i.e. '\400' is illegal. but '\900' is ok, becuase 9 isn't octal digit, and it just matches '900'
				// \b \t \n \v \f \r (\10 .. \15 octal), \e (\33),  -- special chars
				// \^ - cannot, what it is?
				//   for example this gives something:   \^]  = \035  \^2 = \022  \^a - \^z, \^A - \^Z = \001 - \032 (yes both cases)
				//    \^= = \035  \^1 - \^9 = \021 - \031, \^^ = \036, \^\ = \034, \^" = \002 (yes without any other escaping), '\^ ' = '\000'
				//    '\^
				//    '. = '\n'   - physical new line character.
				//    and many others, most maps injectivelly into \000 - \035 range (so exactly 30 integers).
				// there can be physical \n \t characters in atom, and probably more (but they can't be so easly to type :D).
				// they can in theory by in the binary files (reall \b after other character in the file is really interesting case). but this should not be used anyway:
				//  '			'  (yes with REAL TABS there is correct atom equivalent to '\t\t\t'
				// TODO: can be use [\w`~!@....] as shortcut to [a-zA-Z_0-9`~!@...] ?
				i--;
				//var rA = /'((?:[a-zA-Z_0-9`~!@#\$%^&*()\-+=\[\]{}();:"|,./?<> ]|\\["'\\btnrvfe])*)'/g;
				// ' // - to fix stupid highlighting
				var rA = /'((?:[a-zA-Z_0-9`~!@#\$%^&*()\-+=\[\]{}();:"|,./?<> ]|\\["'\\btnrvfe ]|\\[a-wyzA-Z]|\\x[0-9a-fA-F]{2,2}|\\[0-3]?[0-7][0-7]?(?![0-7]))*)'/g;
				// ' // - to fix stupid highlighting
				// (?:  ) means "non capturing group" (we don not need it). 
				// (?!  ) means "not followed by"
				//  we use it for \666  case.  becuase \66,6  is currect, but removing , will create octal 666 which larger than 255
				rA.lastIndex = i;
				m = rA.exec(s);
				if (!m || m.index != i) {
					throw "bad syntax in atom at "+i;
				}
				// TODO: perform actuall unescaping.
				// TODO: is_existing_atom?
				//if (existing)
				return [new EAtom(m[1]), rA.lastIndex];

		default:
			i--;
			if (/^[a-z]$/.test(s[i])) {
				var ra = /([a-z][a-zA-Z_0-9@]*)/g; // TODO: dots
				ra.lastIndex = i;
				m = ra.exec(s);
				if (!m || m.index != i) {
					throw "internal error 7 at "+i;
				}
				if (/^(try|fun|catch|end|begin|if|case|of|when|or(else)?|and(also)?|b(or|and|xor|not|sr|sl))$/.test(m[1])) {
					throw "reserved keyword at "+i;
				}
				// TODO: is_existing_atom?
				//if (existing)
				return [new EAtom(m[1]), ra.lastIndex];
			}
			if (/^[0-9\-+]$/.test(s[i])) {
					// we need /g for lastIndex, then verify if it was anchored correctly.
					// we are using this so we do not need to use substr which can lead to O(n^2) parsing of things like [0,0,0,0,...,0,0,0,0]
					// well, it can still be O(n).
					var rfi = /(?:([\-+]?\d+\.\d+(?:[eE](?:[\-+]?\d+))?)|([\-+]?\d+))/g;

				rfi.lastIndex = i;
				m = rfi.exec(s);
				if (!m) {
					throw "syntax error (looks like number but isn't) 1. internal error in decder 0. please report at "+i;
				}
				if (m.index != i) {
					throw "syntax error (not anchored number) 2 at "+i;
				}
				//debug("m="+toJSON(m));
				//debug("m0='"+m[0]+"' m1='"+m[1]+"' m2='"+m[2]+"'");
				if (lnotxor(m[1], m[2])) {
					throw "internal error in decoder 1. please report. at "+i;
				}
				if (m[2]) {
					assert(m[2].length == rfi.lastIndex-i);
					return [parseInt(m[2], 10), rfi.lastIndex];
				} else if (m[1]) {
					assert(m[1].length == rfi.lastIndex-i);
					var x = parseFloat(m[1]);
					if (x == Infinity || x == -Infinity || isNaN(x)) {
						throw "bad float at "+i;
					}
					return [x, rfi.lastIndex];
				} else {
					throw "internal error in decoder 2: please report. at "+i;
				}
/*
				// These are two old regexp separated into intger and float, first i was checking float and if it faild, then integer.
				// in both cases i was testing if match possition is current position.
				// this was suboptimal, becuase yes we didn't used s.substr(i, s.length), duse avoding copying,
				// but for [0, 0, 0, 0 ,......., 0,0] all float matches will fail (0 is not a float), so float regexp will scan whole string to the end.
				// duse this method is deprecated
				var ri = /([\-+]?\d+)/g;
				// Floats: dot is mandatory (even with "e" syntax).
				//   some digits before AND after dot is also mandatory.
				//   0.000...........00001e1000  is ok.
				var rf = /[\-+]?\d+\.\d+([eE]([\-+]?\d+))?/g;

				rf.lastIndex = i;
				if (m = rf.exec(s)) {
					//assert(rr.leftContext.length == 0); // not available in Opera and Safari
					// we need to check this anchoring, because this should not be accepted:
					// --2.0 (will return -2.0) or 12abc4.56  (will return 4.56). but both are invalid literals.
					if(m.index == i) {
						// Note: parseFloat accepts NaN, Infinity, -Infinity, -0.0
						//  one can construct x=-0.0, but it is dispayed everywhere as 0
						//  it is -0.0 becuase 1.0/x creates -Infinity.
						var x = parseFloat(m[0]);
						if (x==Infinity || x==-Infinity || isNaN(x)) throw "bad float";
						return [x, rf.lastIndex];
					} // or try integer matching
				}

				// TODO: 16#abd51abf, and other bases notation.

				ri.lastIndex = i;
				if (m = ri.exec(s)) {
					if (m.index != i) { throw "error 4"; }
					// in JavaScript parseInt, prefixed 0 assumes that it is octal (base8), so we force base 10
					// or we could use this regexp: /^([\-+]?)0*(0|[1-9]\d*)/  with m[2] as leading-0-free string, but then we will need check sign or append it
					return [parseInt(m[0], 10), ri.lastIndex];
					// Note: parseInt accepts 0x, or 0 prefix, for 16 and 8 bases
				}

				throw "internal error 5";
*/
			}

			if (/^[ \t\n\r]$/.test(s[i])) {
				i++;
				continue decode_again;
			}

			throw "syntax error (unknown character) at "+i;
	} // switch

throw "internal error 11";
}  // while (true);
}

// reserved atoms: try, fun, catch, end, begin, if, case
// but not reserved: throw! :)

//var req = new XMLHttpRequest();
//req.overrideMimeType("text/plain");
//req.open("GET", "http://smp.if.uj.edu.pl/~baryluk/pobierz.php", false);
//R = req.send();

// R[1] can be 1 .. 2^32 inclusisve.
// output in range 1 .. R[1] inclusive.
// see rv.txt for reverse enginered behaviour of this function.

function phash(T, M) {

	var r = 0;
	var type;
	if (T instanceof ETerm) {
		type = T.type();
	} else {
		if ((T instanceof Number) || (typeof T == "number")) {
			type = "integer";
		} else {
			throw "not supported datatype "+(typeof T);
		}
	}
	switch (type) {
		case "atom":
		// atoms are solved completly.
			var x = T.atom_name();
			var r2 = r;
			for (var i = 0; i < x.length; i++) {
				r2 = (16*r2 + x.charCodeAt(i));
				//if (i % 4 == 1) {
					//r -= (1 << 28);
					r = (r + r2) % M;
					//r2 = 0;
				//}
			}
			//r = (r + r2) % M;
			//return ((1 + r) % (1 << 28)) % M;
			//return (1 + r) % M;
			return (1 + r2) % M;

		case "tuple":
		// tuples are solved practically.
			var c = 268439627;
			for (var i = T.tuple_arity()-1; i >= 0; i--) {
				r = (r + 1 + c*(phash(T.get(i), M)-1)) % M;
				c = (c*268440163 % M);
			}
			return (r + 1) % M;

		case "integer":
		// integers are solved practically.
			while (T) {
				r += ( 268435459*((T >> 24) & 0xff) ) % M;
				r += ( (1<<32) - 1073730709*((T >> 16) & 0xff) ) % M;
				r += ( 1920229267*((T >> 8) & 0xff) ) % M;
				r += ( 2788898427*(T & 0xff) ) % M;
				T >>= 32;
			}
			return (r + 1) % M;

		case "float":
			throw "not implemented";

		case "list":
		// lists are much more complicated
			// phash(T.head(), M);
			// and something mor complicated with tail :/
			throw "not implemented";

		default:
			throw "not implemented";
	}
}

