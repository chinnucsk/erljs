-module(erljs_tests).

-export([c/1]).

c(Module) when is_atom(Module) ->
	Modulename = atom_to_list(Module),
	Filename = Modulename,
	{ok, File} = file:open(Filename, [read, {read_ahead, 8192}]),
	{ok, FileErl} = file:open(Modulename ++ ".erl", [write]),
	{ok, FileJS} = file:open(Modulename ++ ".js", [write]),
	ok = file:write(FileErl, ["-module('", Modulename, "').\n"]),
	ok = file:write(FileErl, "-compile([export_all]).\n"),
	ok = file:write(FileJS, ["function ", "unittest__", Modulename, "() {\n"]),
	io:format("Processing lines"),
	process(file:read_line(File), File, [], 1, {Modulename, FileErl, FileJS}).

process(eof, File, _Code, _LineNo, {Modulename, FileErl, FileJS}) ->
	io:format("~n"),
	ok = file:close(File),
	ok = file:close(FileErl),
	ok = file:write(FileJS, "\treturn true;\n}\n"),
	ok = file:close(FileJS),
	{ok, _OutputFile, _Stats} = erljs:c(Modulename),
	ok;
process({ok, Line0}, File, Code, LineNo, Aux = {Modulename, FileErl, FileJS}) ->
	Line1 = string:strip(Line0, both),
	Line2 = string:strip(Line1, both, $\t),
	Line = string:strip(Line2, right, $\n),
	io:format(" ~p", [LineNo]),
	%io:format("Processing lines", [LineNo]),
	%io:format("~p~n", [Line]),
	CodeLine = case Line of
		[] -> Line;
		_ -> case hd(Line) of
			$% -> []; % strip comments
			_ -> Line
		end
	end,
	NewCode = case CodeLine of
		[] ->
			Code;
		_ ->
			{ok, Tokens, _LastLocation} = erl_scan:string(Line),
			%io:format("tokenized~n"),
			{ok, [AbstractExpression]} = erl_parse:parse_exprs(Tokens),
			%io:format("parsed~n"),
			Bindings = erl_eval:new_bindings(),
			{value, Value, _NewBindings} = erl_eval:expr(AbstractExpression, Bindings),
			%io:format("evalueted~n"),
			%io:format("~p~n", [Value]),
			Type = case Line of
				[$e,$r,$l,$a,$n,$g,$:|_] -> wrapper;
				[$m,$a,$t,$h,$:|_] -> wrapper;
				[$(| _] -> term;
				_ -> call
			end,
			case Type of
				wrapper ->
					% more complicated expressions or complicated function calls
					% prepare temporary function for it and compile
					%io:format(FileErl, "test_~w() -> ~s~n", [LineNo, Line]),
					file:write(FileErl, ["test_", integer_to_list(LineNo) ,"() ->\n\t",
						Line, "\n"]),
					%io:format("eq(\"test_~w()\", \"~s\");~n", [LineNo, lists:flatten(io_lib:write(Value))]);
					file:write(FileJS, ["\teq(\"", Modulename, ":test_", integer_to_list(LineNo) ,"()", "\",\n\t\t",
						io_lib:write_string(lists:flatten(io_lib:print(Value,1,1000000000000,-1))), ");\n"]);
				term ->
					io:format(FileJS, "d2(\"~s\", \"~s\");~n", [Line, lists:flatten(io_lib:write(Value))]);
				call ->
					% simple function calls
					file:write(FileJS, ["\teq(\"", Line, "\",\n\t\t",
						io_lib:write_string(lists:flatten(io_lib:print(Value,1,1000000000000,-1))), ");\n"])
			end,
			[{Line, Value}|Code]
	end,
	process(file:read_line(File), File, NewCode, LineNo+1, Aux).


%erl_scan:reserved_word(Atom) - bool
%erl_parse:parse_term(Tokens) -> {ok, Term}
%{ok, ParsedLine} = io:parse_erl_form(Line, ),

