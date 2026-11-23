# Grammar

This page is the formal definition of Cluub's syntax: the lexical rules (how text becomes tokens) and the grammar (how tokens become a program), written in EBNF. It matches the hand-written parser in `compiler/lexer.js` and `compiler/parser.js` exactly; where the two disagree, that is a bug.

What the constructs *mean* (types, validation, scoping, awaiting, errors) is described on the reference page for each construct: see [See also](#see-also).

## Notation

| Notation | Meaning |
|---|---|
| `"word"` | the literal word or symbol |
| `NAME`, `NUMBER`, `TEXT` | a token of that kind (defined below) |
| `[ x ]` | optional |
| `{ x }` | zero or more times |
| `x \| y` | either |
| `( x )` | grouping |
| `(* … *)` | comment |

## Lexical structure

### Source text and lines

A Cluub file is UTF-8 text made of lines. Blank lines and lines containing only a comment are ignored entirely, including for indentation.

### Comments

A comment starts with `#` and runs to the end of the line. There are no block comments.

```text
# a whole-line comment
let total = price * 2   # a trailing comment
```

### Indentation

Blocks are defined by indentation, as in Python, with three strict rules:

1. **Spaces only.** A tab anywhere in the indentation is error **E001**.
2. **Exactly 2 spaces deeper** to open a block. Any other step is error **E002**.
3. **Dedent to a level that exists.** Returning to an indentation no open block uses is error **E003**.

The lexer turns indentation changes into `INDENT` and `DEDENT` tokens, and the end of each logical line into a `NEWLINE` token.

**Line joining:** inside `( )`, `[ ]` and `{ }`, line breaks and indentation are ignored, so long lists and calls may span lines:

```cluub
model Settings
  colors: list of text = [
    "red",
    "green",
  ]
```

### Tokens

```ebnf
NAME    = letter , { letter | digit | "_" } ;          (* letter = A–Z, a–z or "_" *)
NUMBER  = digit , { digit | "_" } , [ "." , digit , { digit | "_" } ] ;
TEXT    = '"' , { character | escape | interpolation } , '"'          (* one line *)
        | '"""' , { any character | escape | interpolation } , '"""' ; (* many lines *)
escape  = "\" , ( "n" | "t" | '"' | "\" | "{" | "}" ) ;
interpolation = "{" , expression , "}" ;
```

* `1_000` is the number 1000. Numbers have no sign; `-5` is the unary minus applied to `5`.
* A one-line text (`"…"`) that reaches the end of the line without its closing quote is error **E004**. Single quotes (`'`) are not allowed at all (**E005**).
* **Triple-quoted text** is dedented: a leading and a trailing blank line are dropped, then the smallest indentation shared by the non-blank lines is removed from every line.
* Inside `{…}` you can use any expression, including text: `"Hello {user.name}"`, `"{items.count} items"`.

### Symbols

```text
->  =>  <=  >=  (  )  [  ]  {  }  ,  :  .  =  +  -  *  /  %  <  >  ?
```

These symbols are **rejected** with error **E006**, because Cluub uses words instead:

| Symbol | Write instead |
|---|---|
| `==` | `is` |
| `!=` | `is not` |
| `&&` | `and` |
| `\|\|` | `or` |
| `!` | `not` |

### Keywords are contextual

Cluub has no globally reserved words. A word such as `view` or `state` is a keyword only where the grammar expects it. Two practical consequences:

* At the start of a statement, a keyword followed by `=` or `.` is read as a name, so `type = "admin"` assigns to a variable called `type`.
* Inside expressions these words always act as operators or literals, so don't use them as names: `and or not is equals has plus minus times divided true false yes no nothing ask request`.

## Program and declarations

```ebnf
program      = { NEWLINE } , { declaration , { NEWLINE } } ;

declaration  = app | model | store | client | service | api
             | page | component | layout | test ;

block(X)     = NEWLINE , INDENT , X , { X } , DEDENT ;
about        = "about" , expression , NEWLINE ;
uses         = "uses" , NAME , { "," , NAME } , NEWLINE ;
```

Any other word at the top level is error **E011**; an unexpected member inside a declaration is error **E012**. Both errors suggest the closest valid word.

### app

```ebnf
app          = "app" , NAME , ( NEWLINE | block( setting ) ) ;
setting      = NAME , expression , NEWLINE ;           (* e.g.  port 3000 *)
```

### model

```ebnf
model        = "model" , NAME , block( about | field ) ;
field        = NAME , ":" , type , [ "=" , expression ] , { "," , rule } , NEWLINE ;
rule         = ( "required"
               | "min" , expression
               | "max" , expression
               | "one" , "of" , expression ) , [ TEXT ] ;   (* TEXT = custom message *)
type         = NAME , [ "of" , type ] , [ "?" ] ;           (* "of" follows "list" *)
```

### store

```ebnf
store        = "store" , NAME , "holds" , NAME , [ "saved" , "in" , expression ] ,
               ( NEWLINE | block( about ) ) ;
```

### client

```ebnf
client       = "client" , NAME , "at" , expression , block( client_member ) ;
client_member= about
             | "header" , expression , expression , NEWLINE
             | route_head , NEWLINE ;
route_head   = method , NAME , "at" , PATH , [ "with" , params ] , [ "->" , type ] ;
method       = "get" | "post" | "put" | "patch" | "delete" ;
PATH         = TEXT ;     (* plain text; "{name}" marks a path parameter, not interpolation *)
params       = param , { "," , param } ;
param        = NAME , [ ":" , type ] , [ "=" , expression ] ;
```

### service

```ebnf
service      = "service" , NAME , block( about | uses | action ) ;
action       = "action" , NAME , [ "(" , [ params ] , ")" ] , [ "->" , type ] , statements ;
```

If the first statement of an action is `about …`, it becomes the action's description.

### api

```ebnf
api          = "api" , NAME , "at" , PATH , block( about | uses | route ) ;
route        = route_head , statements ;
```

### page

```ebnf
page         = "page" , NAME , "at" , PATH , block( page_member ) ;
page_member  = about | uses
             | "layout" , NAME , NEWLINE
             | "title" , expression , NEWLINE
             | "state" , NAME , [ ":" , type ] , "=" , expression , NEWLINE
             | "when" , "loaded" , statements
             | action
             | "view" , view ;
```

### component, layout and test

```ebnf
component    = "component" , NAME , block( about | takes | "view" , view ) ;
takes        = "takes" , params , NEWLINE ;
layout       = "layout" , NAME , block( about | "view" , view ) ;
test         = "test" , TEXT , statements ;
```

## Statements

```ebnf
statements   = block( statement ) ;

statement    = "let" , NAME , "=" , expression , NEWLINE
             | target , "=" , expression , NEWLINE
             | "return" , [ expression ] , NEWLINE
             | "require" , expression , "," , expression , NEWLINE
             | "fail" , expression , [ "status" , expression ] , NEWLINE
             | if_statement
             | "for" , NAME , "in" , expression , statements
             | "while" , expression , statements
             | "try" , statements , "catch" , [ NAME ] , statements
             | "log" , expression , NEWLINE
             | "go" , "to" , expression , NEWLINE
             | about
             | test_statement
             | expression , NEWLINE ;

if_statement = "if" , expression , statements ,
               [ "else" , ( if_statement | statements ) ] ;

target       = NAME
             | postfix , "." , NAME
             | postfix , "[" , expression , "]" ;

test_statement                                    (* only inside `test` (E120) *)
             = "expect" , expression , [ "fails" , [ "with" , expression ] ] , NEWLINE
             | "render" , NAME , NEWLINE
             | "click" , expression , NEWLINE
             | "type" , expression , "into" , expression , NEWLINE ;
```

* `try` without `catch` is a syntax error. If the `catch` name is omitted it is `error`.
* Each statement must end its line; anything left over is error **E010** ("Unexpected … at the end of this line").

## Views

```ebnf
view         = block( view_line ) ;

view_line    = "for" , NAME , "in" , expression , view
             | view_if
             | "slot" , NEWLINE                          (* layouts only *)
             | "on" , NAME , ( statements | expression , NEWLINE )   (* event block for the parent element *)
             | COMPONENT , [ named_arg , { "," , named_arg } ] , NEWLINE
             | element ;

view_if      = "if" , expression , view , [ "else" , ( view_if | view ) ] ;

COMPONENT    = NAME ;                                    (* starts with a capital letter *)
named_arg    = NAME , ":" , expression ;

element      = content_tag , [ expression ] , { [ "," ] , property } , ( NEWLINE | view )
             | container_tag , { [ "," ] , property } , ( NEWLINE | view )
             | void_tag , { [ "," ] , property } , NEWLINE ;

content_tag  = "heading" | "subheading" | "text" | "button" | "input" | "checkbox"
             | "link" | "image" | "label" | "badge" | "item" | "select" ;
container_tag= "row" | "column" | "card" | "box" | "header" | "footer"
             | "nav" | "section" | "grid" | "list" | "form" ;
void_tag     = "divider" | "spinner" ;

property     = "on" , NAME , expression                  (* NAME = click | change | enter | … *)
             | "multiline"
             | "style" , ( NAME | expression )
             | ( "to" | "placeholder" | "type" | "disabled"
               | "class" | "alt" | "options" ) , expression ;
```

* An unknown element name is error **E013** with a suggestion. The parser reports it and continues with the next line, so one typo doesn't hide the rest of the file's problems.
* The comma before the first property is optional, but a comma must be followed by a property.
* Lists, objects and call arguments may end with a trailing comma: `[1, 2, 3,]`.

## Expressions

```ebnf
expression   = lambda | or_expr ;
lambda       = NAME , "=>" , expression
             | "(" , [ NAME , { "," , NAME } ] , ")" , "=>" , expression ;

or_expr      = and_expr , { "or" , and_expr } ;
and_expr     = not_expr , { "and" , not_expr } ;
not_expr     = "not" , not_expr | comparison ;

comparison   = additive , { comparison_op } ;
comparison_op= ( "<" | ">" | "<=" | ">=" | "equals" | "has" ) , additive
             | "is" , [ "not" ] , is_tail ;
is_tail      = "empty"
             | ( "greater" | "more" | "less" | "fewer" ) , "than" , additive
             | "at" , ( "least" | "most" ) , additive
             | "one" , "of" , additive
             | additive ;

additive     = multiplicative , { ( "+" | "plus" | "-" | "minus" ) , multiplicative } ;
multiplicative = unary , { ( "*" | "times" | "/" | "divided" , "by" | "%" ) , unary } ;
unary        = "-" , unary | postfix ;

postfix      = primary , { "." , NAME
                         | "(" , [ argument , { "," , argument } , [ "," ] ] , ")"
                         | "[" , expression , "]" } ;
argument     = [ NAME , ":" ] , expression ;              (* named or positional *)

primary      = NUMBER | TEXT
             | "true" | "false" | "yes" | "no" | "nothing"
             | "[" , [ expression , { "," , expression } , [ "," ] ] , "]"
             | "{" , [ key , ":" , expression , { "," , key , ":" , expression } , [ "," ] ] , "}"
             | "(" , expression , ")"
             | "ask" , "ai" , additive , { ai_option }
             | "request" , method , additive , [ "with" , additive ]   (* tests only *)
             | NAME ;
key          = NAME | TEXT ;
ai_option    = "as" , "one" , "of" , additive
             | "as" , type
             | "using" , additive
             | "with" , "system" , additive ;
```

### Precedence

From lowest (binds last) to highest (binds first):

| Level | Operators | Associativity |
|---|---|---|
| 1 | `x => …` lambda | right |
| 2 | `or` | left |
| 3 | `and` | left |
| 4 | `not` | prefix |
| 5 | `is`, `is not`, `is empty`, `is greater than`, `is at least`, `is one of`, `equals`, `has`, `<`, `>`, `<=`, `>=` | left |
| 6 | `+`, `-`, `plus`, `minus` | left |
| 7 | `*`, `/`, `%`, `times`, `divided by` | left |
| 8 | unary `-` | prefix |
| 9 | `.name`, `(…)` call, `[…]` index | left |

So `not done and total is greater than 10 plus tax` reads as `(not done) and (total > (10 + tax))`.

`is not` negates whatever follows: `x is not empty`, `x is not at least 3`, `x is not one of [...]`.

## Worked example

The annotations show which grammar rules each line uses:

```cluub
service PriceService                        # service
  uses Prices                               # uses
  action total(items: list of number, tax: number = 0) -> number   # action, params, type
    require items is not empty, "No items"  # statement: require; is_tail: empty
    let sum = 0                             # statement: let
    for item in items                       # statement: for
      sum = sum + item                      # target "=" expression; additive
    return round(sum times (1 plus tax), 2) # postfix call with arguments
```

## See also

* [Expressions](/reference/expressions): what each operator does
* [Statements](/reference/statements): semantics of every statement
* [Types](/reference/types): types, validation and coercion
* [View elements](/reference/view-elements) and [Properties & events](/reference/properties-events)
* [Error codes](/reference/errors)
